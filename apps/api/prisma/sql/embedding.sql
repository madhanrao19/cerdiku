-- Applied by `pnpm --filter @kpm/api db:vector` AFTER `prisma db push`.
-- Adds the pgvector column + ANN index that Prisma's schema language can't
-- express. Idempotent so it is safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "EmbeddingChunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "embeddingchunk_embedding_idx"
  ON "EmbeddingChunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
