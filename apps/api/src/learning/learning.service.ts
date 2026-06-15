import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { SubmitAttemptInput, MasteryBand } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async getLesson(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' }, include: { mediaAssets: true } },
        activities: true,
        learningStandard: {
          select: {
            id: true,
            title: true,
            contentStandardCode: true,
            learningStandardCode: true,
            performanceStandardCode: true,
          },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async startActivity(activityId: string, studentId: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Activity not found');
    const attempt = await this.prisma.attempt.create({
      data: { activityId, studentId },
    });
    return { attemptId: attempt.id, config: activity.config };
  }

  // Auto-marks objective items; short responses are left for the review queue.
  async submitAttempt(attemptId: string, studentId: string, input: SubmitAttemptInput) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { activity: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException('Not your attempt');

    const config = attempt.activity.config as {
      items?: Array<{ id: string; answer?: string | number; autoMark?: boolean }>;
    };
    const items = config.items ?? [];

    let correct = 0;
    let autoMarkable = 0;
    for (const item of items) {
      if (item.autoMark === false || item.answer === undefined) continue;
      autoMarkable += 1;
      const response = input.responses.find((r) => r.questionId === item.id);
      if (response && String(response.answer) === String(item.answer)) correct += 1;
    }

    const score = autoMarkable > 0 ? (correct / autoMarkable) * 100 : null;
    const masteryBand = bandFromScore(score);

    const saved = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        responses: input.responses as never,
        score: score ?? undefined,
        masteryBand,
        submittedAt: new Date(),
      },
    });

    // Roll the result into the standard-level progress record (PBD-style).
    await this.updateProgress(studentId, attempt.activity.lessonId, score, masteryBand);

    return {
      attemptId: saved.id,
      score,
      masteryBand,
      needsManualReview: autoMarkable < items.length,
    };
  }

  private async updateProgress(
    studentId: string,
    lessonId: string,
    score: number | null,
    band: MasteryBand,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { learningStandardId: true },
    });
    if (!lesson) return;

    const tahap = tahapFromBand(band);
    await this.prisma.progressRecord.upsert({
      where: {
        studentId_learningStandardId: {
          studentId,
          learningStandardId: lesson.learningStandardId,
        },
      },
      create: {
        studentId,
        learningStandardId: lesson.learningStandardId,
        masteryScore: score ?? 0,
        currentTahapPenguasaan: tahap ? String(tahap) : null,
        evidenceSummary: { lastScore: score, lastBand: band } as never,
      },
      update: {
        masteryScore: score ?? 0,
        currentTahapPenguasaan: tahap ? String(tahap) : undefined,
        evidenceSummary: { lastScore: score, lastBand: band } as never,
      },
    });
  }
}

function bandFromScore(score: number | null): MasteryBand {
  if (score === null) return 'NONE';
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'NONE';
}

// Map mastery band → PBD Tahap Penguasaan (1..6) for parent reporting.
function tahapFromBand(band: MasteryBand): number | null {
  switch (band) {
    case 'HIGH':
      return 6;
    case 'MEDIUM':
      return 4;
    case 'LOW':
      return 2;
    default:
      return null;
  }
}
