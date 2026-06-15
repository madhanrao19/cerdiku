import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../common/rbac.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  // Cohort dashboard: completion, mastery, usage, intervention counts.
  @Roles('ADMIN')
  @Get('cohorts')
  async cohorts() {
    const [students, attempts, avgMastery, interventions, tutorSessions] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.attempt.count({ where: { submittedAt: { not: null } } }),
      this.prisma.progressRecord.aggregate({ _avg: { masteryScore: true } }),
      this.prisma.tutorMessage.count({ where: { needsReview: true } }),
      this.prisma.tutorSession.count(),
    ]);

    const byLevel = await this.prisma.student.groupBy({
      by: ['level'],
      _count: { _all: true },
    });

    return {
      totals: {
        students,
        submittedAttempts: attempts,
        tutorSessions,
        openInterventions: interventions,
        avgMasteryScore: Number(avgMastery._avg.masteryScore ?? 0).toFixed(1),
      },
      studentsByLevel: byLevel.map((b) => ({ level: b.level, count: b._count._all })),
    };
  }
}
