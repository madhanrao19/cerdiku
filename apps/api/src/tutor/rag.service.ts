import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AiProviderClient, RetrievalFilter, RetrievedChunk } from '@kpm/types';
import { PrismaService } from '../prisma/prisma.service.js';
import { AI_PROVIDER } from '../ai/ai.module.js';

@Injectable()
export class RagService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AiProviderClient,
  ) {}

  // Filtered ANN retrieval. The filter dimensions (curriculum version, school
  // type, language, DLP) are denormalized onto EmbeddingChunk so a child only
  // ever retrieves facts from their assigned variant. Embedding column is
  // pgvector, so this uses a raw query (Prisma can't express vector ops).
  async retrieve(query: string, filter: RetrievalFilter, k = 5): Promise<RetrievedChunk[]> {
    const [embedding] = await this.ai.embed([query]);
    // Defensive: a provider returning no embedding must not crash retrieval —
    // degrade to the plain filtered fallback instead.
    if (!embedding || embedding.length === 0) return this.fallback(filter, k);
    const vectorLiteral = `[${embedding.join(',')}]`;

    const conditions: Prisma.Sql[] = [Prisma.sql`"embedding" IS NOT NULL`];
    if (filter.curriculumVersionCode)
      conditions.push(Prisma.sql`"curriculumVersionCode" = ${filter.curriculumVersionCode}`);
    if (filter.schoolType)
      conditions.push(Prisma.sql`"schoolType" = ${filter.schoolType}::"SchoolType"`);
    if (filter.language)
      conditions.push(Prisma.sql`"language" = ${filter.language}::"Language"`);
    if (filter.dlpMode) conditions.push(Prisma.sql`"dlpMode" = ${filter.dlpMode}::"DlpMode"`);
    if (filter.lessonId) conditions.push(Prisma.sql`"lessonId" = ${filter.lessonId}::uuid`);
    if (filter.subjectVariantId)
      conditions.push(Prisma.sql`"subjectVariantId" = ${filter.subjectVariantId}::uuid`);

    const where = Prisma.join(conditions, ' AND ');

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; content: string; lessonId: string | null; subjectVariantId: string | null; distance: number }>
      >(Prisma.sql`
        SELECT "id", "content", "lessonId", "subjectVariantId",
               "embedding" <=> ${vectorLiteral}::vector AS distance
        FROM "EmbeddingChunk"
        WHERE ${where}
        ORDER BY distance ASC
        LIMIT ${k}
      `);
      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        lessonId: r.lessonId ?? undefined,
        subjectVariantId: r.subjectVariantId ?? undefined,
        score: 1 - r.distance,
      }));
    } catch {
      // Vector column not yet present (e.g. db push without db:vector) — fall
      // back to a plain filtered fetch so the tutor still works in dev.
      return this.fallback(filter, k);
    }
  }

  private async fallback(filter: RetrievalFilter, k: number): Promise<RetrievedChunk[]> {
    const rows = await this.prisma.embeddingChunk.findMany({
      where: {
        curriculumVersionCode: filter.curriculumVersionCode,
        schoolType: filter.schoolType as never,
        language: filter.language as never,
        dlpMode: filter.dlpMode as never,
        lessonId: filter.lessonId,
        subjectVariantId: filter.subjectVariantId,
      },
      take: k,
    });
    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      lessonId: r.lessonId ?? undefined,
      subjectVariantId: r.subjectVariantId ?? undefined,
      score: 0.5,
    }));
  }
}
