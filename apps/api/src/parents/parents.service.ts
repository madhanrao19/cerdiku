import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import type { AiProviderClient, StudyPlanInput } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';
import { AI_PROVIDER } from '../ai/ai.module.js';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AiProviderClient,
  ) {}

  async dashboard(householdId: string | null) {
    if (!householdId) throw new ForbiddenException('No household');
    const students = await this.prisma.student.findMany({
      where: { householdId },
      include: {
        progressRecords: { include: { learningStandard: { select: { title: true } } } },
        enrollments: {
          include: { subjectVariant: { include: { subject: true } }, studyPlans: true },
        },
      },
    });

    const subscription = await this.prisma.subscription.findFirst({
      where: { householdId },
      include: { invoices: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });

    const flags = await this.prisma.tutorMessage.findMany({
      where: { needsReview: true, tutorSession: { student: { householdId } } },
      include: { tutorSession: { select: { studentId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        level: s.level,
        masteryAvg: avg(s.progressRecords.map((p) => Number(p.masteryScore))),
        subjects: s.enrollments.map((e) => ({
          subject: e.subjectVariant.subject.name,
          weeklyTargetMinutes: e.studyPlans[0]?.weeklyTargetMinutes ?? null,
        })),
      })),
      subscription,
      aiFlags: flags.map((f) => ({
        messageId: f.id,
        studentId: f.tutorSession.studentId,
        createdAt: f.createdAt,
      })),
    };
  }

  async setStudyPlan(householdId: string | null, input: StudyPlanInput) {
    if (!householdId) throw new ForbiddenException('No household');
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: input.enrollmentId, student: { householdId } },
    });
    if (!enrollment) throw new ForbiddenException('Enrollment not in your household');

    return this.prisma.studyPlan.upsert({
      where: { id: input.enrollmentId }, // best-effort; falls through to create
      create: {
        enrollmentId: input.enrollmentId,
        pacingMode: input.pacingMode,
        weeklyTargetMinutes: input.weeklyTargetMinutes,
        schedule: input.schedule as never,
      },
      update: {
        pacingMode: input.pacingMode,
        weeklyTargetMinutes: input.weeklyTargetMinutes,
        schedule: input.schedule as never,
      },
    });
  }

  async studentProgress(studentId: string) {
    const records = await this.prisma.progressRecord.findMany({
      where: { studentId },
      include: { learningStandard: { select: { title: true, strand: true } } },
    });
    return records;
  }

  // Parent-readable PBD report with an AI-written narrative summary.
  async pbdReport(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    const records = await this.prisma.progressRecord.findMany({
      where: { studentId },
      include: { learningStandard: { select: { title: true } } },
    });
    const summary = await this.ai.summarizeProgress({
      studentName: student?.fullName ?? 'Student',
      records: records.map((r) => ({
        standard: r.learningStandard.title,
        mastery: Number(r.masteryScore),
        tahap: r.currentTahapPenguasaan ? Number(r.currentTahapPenguasaan) : null,
      })),
    });
    return {
      student: { id: student?.id, name: student?.fullName, level: student?.level },
      summary,
      standards: records.map((r) => ({
        title: r.learningStandard.title,
        masteryScore: Number(r.masteryScore),
        tahapPenguasaan: r.currentTahapPenguasaan,
      })),
    };
  }
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
