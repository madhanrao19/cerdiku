-- pgvector bootstrap. Runs before the Prisma-generated schema migration so the
-- `vector` extension/type exists when EmbeddingChunk is created.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
