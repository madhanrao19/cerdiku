import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID, createHash } from 'node:crypto';
import type {
  RegisterParentInput,
  RegisterStudentInput,
  LoginInput,
} from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/rbac.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async registerParent(input: RegisterParentInput): Promise<{ userId: string } & TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(input.password);

    const { user } = await this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { displayName: input.householdName, locale: input.locale },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: 'PARENT',
          householdId: household.id,
        },
      });
      await tx.consent.create({
        data: { userId: user.id, consentType: 'PRIVACY_NOTICE', version: '1.0' },
      });
      return { user };
    });

    await this.audit.record({
      userId: user.id,
      action: 'auth.register_parent',
      entityType: 'User',
      entityId: user.id,
    });

    const tokens = await this.issueTokens(this.toAuthUser(user));
    return { userId: user.id, ...tokens };
  }

  async registerStudent(
    guardian: AuthUser,
    input: RegisterStudentInput,
  ): Promise<{ studentId: string }> {
    if (!guardian.householdId) {
      throw new NotFoundException('Guardian has no household');
    }

    const student = await this.prisma.$transaction(async (tx) => {
      let studentUserId: string | undefined;
      if (input.username && input.password) {
        const u = await tx.user.create({
          data: {
            // Child login without email: synthesize a local-only identifier.
            email: null,
            phone: null,
            passwordHash: await argon2.hash(input.password),
            role: 'STUDENT',
            householdId: guardian.householdId,
          },
        });
        studentUserId = u.id;
        // store username in a lightweight way via audit/metadata — see note below
        await tx.auditLog.create({
          data: {
            userId: u.id,
            action: 'auth.student_username_set',
            entityType: 'User',
            entityId: u.id,
            metadata: { username: input.username },
          },
        });
      }
      return tx.student.create({
        data: {
          householdId: guardian.householdId!,
          userId: studentUserId,
          fullName: input.fullName,
          dob: input.dob,
          level: input.level,
          languagePref: input.languagePref,
          dlpMode: input.dlpMode,
          schoolType: input.schoolType,
          guardians: {
            create: { userId: guardian.sub, relationship: 'parent', isPrimary: true },
          },
        },
      });
    });

    await this.audit.record({
      userId: guardian.sub,
      action: 'auth.register_student',
      entityType: 'Student',
      entityId: student.id,
    });
    return { studentId: student.id };
  }

  async login(input: LoginInput): Promise<{ userId: string; role: string } & TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.identifier }, { phone: input.identifier }],
        isActive: true,
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(this.toAuthUser(user));
    await this.audit.record({
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
    });
    return { userId: user.id, role: user.role, ...tokens };
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const hash = hashToken(rawRefreshToken);
    const session = await this.prisma.authSession.findFirst({
      where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    // Rotation: revoke the used token, issue a new pair.
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(this.toAuthUser(session.user));
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.prisma.authSession.updateMany({
      where: { refreshTokenHash: hashToken(rawRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        householdId: true,
        organizationId: true,
        studentProfile: { select: { id: true, fullName: true, level: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(user, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TTL,
    });
    const rawRefresh = randomUUID() + randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
    await this.prisma.authSession.create({
      data: {
        userId: user.sub,
        refreshTokenHash: hashToken(rawRefresh),
        expiresAt,
      },
    });
    return { accessToken, refreshToken: rawRefresh };
  }

  private toAuthUser(user: {
    id: string;
    role: string;
    householdId: string | null;
    organizationId: string | null;
  }): AuthUser {
    return {
      sub: user.id,
      role: user.role as AuthUser['role'],
      householdId: user.householdId,
      organizationId: user.organizationId,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
