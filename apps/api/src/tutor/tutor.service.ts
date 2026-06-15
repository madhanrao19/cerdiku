import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AiProviderClient,
  OpenTutorSessionInput,
  StudentContext,
  TutorMode,
  TutorReplyResult,
} from '@kpm/types';
import { moderateInput, moderateOutput } from '@kpm/ai';
import { PrismaService } from '../prisma/prisma.service.js';
import { AI_PROVIDER } from '../ai/ai.module.js';
import { RagService } from './rag.service.js';

export interface TutorStreamEvent {
  type: 'token' | 'final' | 'blocked';
  data: string | TutorReplyResult;
}

@Injectable()
export class TutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
    @Inject(AI_PROVIDER) private readonly ai: AiProviderClient,
  ) {}

  async openSession(input: OpenTutorSessionInput) {
    const student = await this.prisma.student.findUnique({ where: { id: input.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    return this.prisma.tutorSession.create({
      data: {
        studentId: input.studentId,
        lessonId: input.lessonId,
        provider: process.env.AI_PROVIDER ?? 'anthropic',
        mode: input.mode,
      },
    });
  }

  // Full pipeline: pre-moderation → retrieval → generation (streamed) →
  // post-moderation → persistence (message, citations, moderation events,
  // intervention flag). Yields SSE-friendly events.
  async *streamMessage(
    sessionId: string,
    content: string,
    mode?: TutorMode,
  ): AsyncGenerator<TutorStreamEvent> {
    const session = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
      include: {
        student: true,
        messages: { orderBy: { createdAt: 'asc' }, take: 10 },
      },
    });
    if (!session) throw new NotFoundException('Tutor session not found');

    // Persist the student's message first (educational record).
    const studentMsg = await this.prisma.tutorMessage.create({
      data: { tutorSessionId: sessionId, authorType: 'STUDENT', content },
    });

    // 1) Pre-generation moderation.
    const pre = await moderateInput(this.ai, content);
    await this.prisma.moderationEvent.create({
      data: {
        tutorMessageId: studentMsg.id,
        stage: 'pre',
        policyResult: pre.classification.result,
        scores: pre.classification.scores as never,
      },
    });
    if (!pre.allowed) {
      const safe = pre.studentSafeMessage ?? 'I can’t help with that here.';
      const blockedMsg = await this.prisma.tutorMessage.create({
        data: {
          tutorSessionId: sessionId,
          authorType: 'ASSISTANT',
          content: safe,
          needsReview: pre.escalate,
        },
      });
      if (pre.escalate) await this.flagIntervention(blockedMsg.id, session.studentId);
      yield { type: 'blocked', data: safe };
      return;
    }

    // 2) Retrieval scoped to the student's variant.
    const filter = this.filterFor(session.student, session.lessonId);
    const retrieved = await this.rag.retrieve(content, filter);

    // 3) Generation (streamed).
    const stream = this.ai.generateTutorReply({
      student: this.studentContext(session.student),
      mode: mode ?? (session.mode as TutorMode),
      question: content,
      history: session.messages.map((m) => ({
        role: m.authorType === 'STUDENT' ? 'student' : 'assistant',
        content: m.content,
      })),
      retrieved,
    });

    for await (const token of stream) {
      yield { type: 'token', data: token };
    }
    const final = await stream.final();

    // 4) Post-generation moderation.
    const post = await moderateOutput(this.ai, final.answer_markdown);

    // 5) Persist assistant message + citations + moderation + intervention.
    const assistantMsg = await this.prisma.tutorMessage.create({
      data: {
        tutorSessionId: sessionId,
        authorType: 'ASSISTANT',
        content: final.answer_markdown,
        masterySignal: final.mastery_signal.toUpperCase() as never,
        needsReview: final.needs_parent_or_admin_review || post.escalate,
        retrievalMetadata: { chunkIds: retrieved.map((c) => c.id) } as never,
        citations: {
          create: retrieved
            .filter((c) => final.citations.includes(c.id))
            .map((c) => ({
              sourceType: 'embedding_chunk',
              sourceId: c.id,
              locator: c.lessonId ?? null,
            })),
        },
        moderationEvents: {
          create: {
            stage: 'post',
            policyResult: post.classification.result,
            scores: post.classification.scores as never,
          },
        },
      },
    });

    if (final.needs_parent_or_admin_review || post.escalate) {
      await this.flagIntervention(assistantMsg.id, session.studentId);
    }

    yield { type: 'final', data: final };
  }

  private async flagIntervention(messageId: string, studentId: string) {
    // Intervention = a needs_review message + an audit trail entry a Safety
    // Reviewer queue reads from. (Kept lightweight; worker notifies reviewers.)
    await this.prisma.auditLog.create({
      data: {
        action: 'tutor.intervention_flagged',
        entityType: 'TutorMessage',
        entityId: messageId,
        metadata: { studentId },
      },
    });
  }

  private filterFor(
    student: { schoolType: string; languagePref: string; dlpMode: string },
    lessonId: string | null,
  ) {
    return {
      schoolType: student.schoolType as never,
      language: student.languagePref as never,
      dlpMode: student.dlpMode as never,
      lessonId: lessonId ?? undefined,
    };
  }

  private studentContext(student: {
    dob: Date;
    level: string;
    schoolType: string;
    languagePref: string;
    dlpMode: string;
  }): StudentContext {
    const age = Math.floor((Date.now() - student.dob.getTime()) / (365.25 * 86_400_000));
    return {
      ageBand: age <= 6 ? '4-6' : age <= 9 ? '7-9' : age <= 12 ? '10-12' : '13+',
      level: student.level as never,
      schoolType: student.schoolType as never,
      languagePref: student.languagePref as never,
      dlpMode: student.dlpMode as never,
      responseLength: age <= 9 ? 'short' : 'medium',
    };
  }
}
