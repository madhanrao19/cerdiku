import './tracing.js'; // must be first — starts OpenTelemetry before other imports
import 'reflect-metadata';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createAiProvider } from '@kpm/ai';
import {
  connection,
  QUEUES,
  type EmbeddingJob,
  type ModerationEscalationJob,
  type ReportJob,
} from './queues.js';

const prisma = new PrismaClient();
const ai = createAiProvider(process.env);

// 1) Embedding worker — chunks are embedded and the pgvector column updated.
const embeddingWorker = new Worker<EmbeddingJob>(
  QUEUES.embedding,
  async (job) => {
    const [vec] = await ai.embed([job.data.content]);
    await prisma.$executeRawUnsafe(
      `UPDATE "EmbeddingChunk" SET "embedding" = $1::vector WHERE id = $2`,
      `[${vec.join(',')}]`,
      job.data.chunkId,
    );
  },
  { connection },
);

// 2) Moderation escalation — notifies a Safety Reviewer (email stub + audit).
const moderationWorker = new Worker<ModerationEscalationJob>(
  QUEUES.moderation,
  async (job) => {
    await prisma.auditLog.create({
      data: {
        action: 'worker.moderation_escalation_notified',
        entityType: 'TutorMessage',
        entityId: job.data.tutorMessageId,
        metadata: { studentId: job.data.studentId },
      },
    });
    // TODO(prod): send email/SMS to reviewer + parent per SOP.
  },
  { connection },
);

// 3) Parent report generation — precomputes the AI progress narrative.
const reportsWorker = new Worker<ReportJob>(
  QUEUES.reports,
  async (job) => {
    const student = await prisma.student.findUnique({ where: { id: job.data.studentId } });
    const records = await prisma.progressRecord.findMany({
      where: { studentId: job.data.studentId },
      include: { learningStandard: { select: { title: true } } },
    });
    const summary = await ai.summarizeProgress({
      studentName: student?.fullName ?? 'Student',
      records: records.map((r) => ({
        standard: r.learningStandard.title,
        mastery: Number(r.masteryScore),
        tahap: r.currentTahapPenguasaan ? Number(r.currentTahapPenguasaan) : null,
      })),
    });
    await prisma.auditLog.create({
      data: {
        action: 'worker.parent_report_generated',
        entityType: 'Student',
        entityId: job.data.studentId,
        metadata: { summaryPreview: summary.slice(0, 200) },
      },
    });
  },
  { connection },
);

for (const w of [embeddingWorker, moderationWorker, reportsWorker]) {
  w.on('failed', (job, err) => console.error(`[${w.name}] job ${job?.id} failed:`, err.message));
}
console.log('Workers started: embedding, moderation-escalation, parent-reports');

async function shutdown() {
  await Promise.all([embeddingWorker.close(), moderationWorker.close(), reportsWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
