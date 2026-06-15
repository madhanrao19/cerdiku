-- Add the pgvector column + ANN index to EmbeddingChunk. This is applied AFTER
-- the Prisma-generated table migration (lexicographically later timestamp).
-- 1536 dims matches text-embedding-3-small / Azure equivalents; change if you
-- swap embedding models (see docs/ai-tutor.md).

ALTER TABLE "EmbeddingChunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- IVFFlat needs data to build well; this is fine for an empty/seed table and is
-- rebuilt as volume grows. Cosine distance pairs with normalized embeddings.
CREATE INDEX IF NOT EXISTS "embeddingchunk_embedding_idx"
  ON "EmbeddingChunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Performance-sensitive composite index for filtered retrieval is already
-- declared in schema.prisma via @@index; these are extra hot-path indexes.
CREATE INDEX IF NOT EXISTS "attempt_student_submitted_idx"
  ON "Attempt" ("studentId", "submittedAt" DESC);

CREATE INDEX IF NOT EXISTS "tutormessage_session_created_idx"
  ON "TutorMessage" ("tutorSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "moderationevent_flagged_idx"
  ON "ModerationEvent" ("policyResult")
  WHERE "policyResult" <> 'PASS';
