import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const QUEUES = {
  embedding: 'embedding',
  moderation: 'moderation-escalation',
  reports: 'parent-reports',
} as const;

// Producers (imported by the API to enqueue work).
export const embeddingQueue = new Queue(QUEUES.embedding, { connection });
export const moderationQueue = new Queue(QUEUES.moderation, { connection });
export const reportsQueue = new Queue(QUEUES.reports, { connection });

export interface EmbeddingJob {
  chunkId: string;
  content: string;
}
export interface ModerationEscalationJob {
  tutorMessageId: string;
  studentId: string;
}
export interface ReportJob {
  studentId: string;
}
