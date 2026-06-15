import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { privacyRequestSchema, type PrivacyRequestInput } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, Roles, type AuthUser } from '../common/rbac.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

// PDPA-aligned data subject workflows. Export assembles the user's records;
// delete-request initiates anonymization (soft-delete + audit) rather than a
// hard wipe, so reporting history is not corrupted.
@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Roles('PARENT', 'ADMIN')
  @Post('export')
  @UsePipes(new ZodValidationPipe(privacyRequestSchema))
  async export(@CurrentUser() actor: AuthUser, @Body() body: PrivacyRequestInput) {
    const [user, students, consents, tutorSessions] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: body.subjectUserId } }),
      this.prisma.student.findMany({ where: { userId: body.subjectUserId } }),
      this.prisma.consent.findMany({ where: { userId: body.subjectUserId } }),
      this.prisma.tutorSession.findMany({
        where: { student: { userId: body.subjectUserId } },
        include: { messages: true },
      }),
    ]);
    await this.audit.record({
      userId: actor.sub,
      action: 'privacy.export',
      entityType: 'User',
      entityId: body.subjectUserId,
    });
    return { user, students, consents, tutorSessions, generatedAt: new Date().toISOString() };
  }

  @Roles('PARENT', 'ADMIN')
  @Post('delete-request')
  @UsePipes(new ZodValidationPipe(privacyRequestSchema))
  async deleteRequest(@CurrentUser() actor: AuthUser, @Body() body: PrivacyRequestInput) {
    await this.prisma.user.update({
      where: { id: body.subjectUserId },
      data: { isActive: false, email: null, phone: null },
    });
    await this.audit.record({
      userId: actor.sub,
      action: 'privacy.delete_request',
      entityType: 'User',
      entityId: body.subjectUserId,
      metadata: { reason: body.reason ?? null },
    });
    return { ok: true, status: 'anonymization_queued' };
  }
}
