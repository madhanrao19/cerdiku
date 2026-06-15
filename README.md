# Cerdiku

**Cerdiku** is a Malaysia **KPM-aligned** digital learning platform for preschool,
primary, and secondary home learners. Positioned as a subscription learning platform for
parents and students — **not** a registered school — with a versioned curriculum
engine, school-type/language/DLP variants, an RAG-grounded child-safe AI tutor,
PBD-style progress tracking, payments, and admin operations.

> **Legal/content posture:** ships only original placeholder content mapped to
> curriculum *metadata*. It does **not** include copyrighted KPM textbook text.
> See [docs/privacy-and-safety.md](docs/privacy-and-safety.md).

## Stack

| Layer        | Choice |
|--------------|--------|
| Monorepo     | pnpm + Turborepo |
| Frontend     | Next.js (App Router) + TypeScript + Tailwind + TanStack Query |
| Backend      | NestJS + Fastify + Prisma |
| Database     | PostgreSQL + pgvector |
| Cache/queue  | Redis + BullMQ |
| Object store | S3-compatible (MinIO dev / Azure Blob prod) |
| AI           | Provider abstraction: Anthropic / OpenAI / Azure OpenAI (+ mock fallback) |

## Repository layout

```
apps/
  web/      Next.js frontend (parent / student / admin portals)
  api/      NestJS API + Prisma schema, migrations, seed
  worker/   BullMQ workers (embeddings, moderation escalation, reports)
packages/
  types/    Shared enums + Zod DTOs + AI contracts (@kpm/types)
  config/   Validated env loader + feature flags (@kpm/config)
  ai/       Provider-agnostic AI layer + prompts + moderation (@kpm/ai)
  curriculum/ Curriculum helpers + seed data builders (@kpm/curriculum)
  observability/ OpenTelemetry init (@kpm/observability)
  ui/       Shared React components (@kpm/ui)
infra/
  docker/   Local dev compose (postgres+pgvector, redis, minio, mailpit)
  hostinger/ VPS deploy script + reverse proxy
  azure/    Bicep templates
docs/       Architecture, API, AI tutor, deployment, privacy & safety
```

## Quickstart (local, no API keys required)

The AI layer falls back to a deterministic **mock provider** when no model keys
are set, so the whole platform runs offline.

```bash
# 0. prerequisites: Node >= 20.11, pnpm 9, Docker
cp .env.example .env
pnpm install

# 1. start infra (postgres+pgvector, redis, minio, mailpit)
pnpm dev:infra

# 2. create schema + pgvector column + seed demo data
pnpm --filter @kpm/api db:push
pnpm --filter @kpm/api db:vector
pnpm --filter @kpm/api db:seed

# 3. run everything (web :3000, api :4000, worker)
pnpm dev
```

Demo logins are printed by the seed script (parent / student / admin).

### Production migrations

For production use the committed Prisma migrations instead of `db push`:

```bash
pnpm --filter @kpm/api prisma migrate deploy
```

Ordering: `pgvector_init` (extensions) → generated schema migration →
`embedding_vector` (vector column + ANN index).

## Documentation

- [Architecture + ER diagram + tutor sequence](docs/architecture.md)
- [API reference](docs/api.md)
- [AI tutor design](docs/ai-tutor.md)
- [Deploy: Hostinger VPS](docs/deployment-hostinger.md)
- [Deploy: Azure](docs/deployment-azure.md)
- [Privacy & safety](docs/privacy-and-safety.md)
