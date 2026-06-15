import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@kpm/types';

export interface AuthUser {
  sub: string; // user id
  role: Role;
  householdId?: string | null;
  organizationId?: string | null;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

// Pulls the validated user off the request (set by JwtAuthGuard).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest();
    const token = extractToken(req);

    if (token) {
      try {
        req.user = await this.jwt.verifyAsync<AuthUser>(token, {
          secret: process.env.JWT_ACCESS_SECRET,
        });
      } catch {
        if (!isPublic) throw new UnauthorizedException('Invalid or expired token');
      }
    } else if (!isPublic) {
      throw new UnauthorizedException('Authentication required');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (requiredRoles?.length) {
      const user = req.user as AuthUser | undefined;
      if (!user || !requiredRoles.includes(user.role)) {
        throw new ForbiddenException('Insufficient role');
      }
    }
    return true;
  }
}

function extractToken(req: {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string>;
}): string | null {
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies?.['access_token'] ?? null;
}
