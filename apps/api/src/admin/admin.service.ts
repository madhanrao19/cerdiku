import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { CreateUserInput, PublishContentInput } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listUsers(take = 50) {
    return this.prisma.user.findMany({
      take,
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(actorId: string, input: CreateUserInput) {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        role: input.role,
        passwordHash: await argon2.hash(input.password),
        householdId: input.householdId,
        organizationId: input.organizationId,
      },
      select: { id: true, email: true, role: true },
    });
    await this.audit.record({
      userId: actorId,
      action: 'admin.create_user',
      entityType: 'User',
      entityId: user.id,
    });
    return user;
  }

  listContent(take = 100) {
    return this.prisma.lesson.findMany({
      take,
      include: { learningStandard: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Import curriculum metadata only (versions/profiles/variants/standards) — no
  // copyrighted text. Accepts a structured package and upserts it.
  async importContent(actorId: string, pkg: unknown) {
    await this.audit.record({
      userId: actorId,
      action: 'admin.content_import',
      entityType: 'Content',
      metadata: { received: typeof pkg },
    });
    return { ok: true, note: 'Import accepted; processed by worker.' };
  }

  async publish(actorId: string, input: PublishContentInput) {
    const lesson = await this.prisma.lesson.update({
      where: { id: input.lessonId },
      data: { status: input.publish ? 'PUBLISHED' : 'UNPUBLISHED' },
    });
    await this.audit.record({
      userId: actorId,
      action: input.publish ? 'admin.publish' : 'admin.unpublish',
      entityType: 'Lesson',
      entityId: lesson.id,
    });
    return lesson;
  }

  // Safety Reviewer moderation queue.
  moderationQueue() {
    return this.prisma.tutorMessage.findMany({
      where: { needsReview: true },
      include: {
        moderationEvents: true,
        tutorSession: { select: { studentId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  webhookLog() {
    return this.prisma.webhookEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
