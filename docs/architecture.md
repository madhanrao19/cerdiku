# Architecture

## Overview

A TypeScript monorepo (pnpm + Turborepo) with three deployable apps and five
shared packages.

- **apps/web** — Next.js App Router frontend (parent / student / admin portals).
- **apps/api** — NestJS + Fastify REST API; Prisma over PostgreSQL; SSE for tutor.
- **apps/worker** — BullMQ workers (embeddings, moderation escalation, reports).
- **packages/types** — enums + Zod DTOs + AI contracts (shared by web & api).
- **packages/config** — validated env loader + feature flags.
- **packages/ai** — provider-agnostic AI layer (Anthropic / OpenAI / Azure / mock).
- **packages/ui** — shared React primitives.
- **packages/curriculum** — curriculum helpers (reserved for import tooling).
- **packages/observability** — `initTracing(serviceName)`: OpenTelemetry NodeSDK +
  OTLP exporter + auto-instrumentations. Called first in the api/worker bootstrap;
  no-op unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Exports to any OTLP collector
  or the Azure Monitor exporter.

Postgres is the system of record; pgvector holds embeddings beside relational
data. Redis backs sessions, caching, and the BullMQ queues. Object storage is
S3-compatible (MinIO in dev, Azure Blob in prod).

## Core modeling decisions

1. A child belongs to a household and may also hold an independent login.
2. Curriculum is **versioned** and modeled as `SubjectVariant` keyed by
   `(subject, curriculum version, level, school_type, language, dlp_mode)` —
   never a single translated syllabus tree.
3. Progress is stored against **learning standards + evidence** (`ProgressRecord`
   with a PBD-style `currentTahapPenguasaan`), not just lesson completion.
4. AI conversations are educational records: moderated, cited, retention-controlled.
5. Billing belongs to the household/organization, never a child identity.

## ER diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : has
    HOUSEHOLDS ||--o{ USERS : contains
    HOUSEHOLDS ||--o{ STUDENTS : contains
    USERS ||--o{ STUDENT_GUARDIANS : guardian
    STUDENTS ||--o{ STUDENT_GUARDIANS : linked

    CURRICULUM_VERSIONS ||--o{ SUBJECT_VARIANTS : versions
    SUBJECTS ||--o{ SUBJECT_VARIANTS : specializes
    SUBJECT_VARIANTS ||--o{ LEARNING_STANDARDS : defines
    LEARNING_STANDARDS ||--o{ LESSONS : maps_to
    LESSONS ||--o{ LESSON_BLOCKS : contains
    LESSON_BLOCKS }o--o{ MEDIA_ASSETS : uses
    LESSONS ||--o{ ACTIVITIES : includes
    SUBJECT_VARIANTS ||--o{ EMBEDDING_CHUNKS : indexed_as
    LESSONS ||--o{ EMBEDDING_CHUNKS : chunked_into

    SCHOOL_PROFILES ||--o{ ENROLLMENTS : classifies
    STUDENTS ||--o{ ENROLLMENTS : has
    ENROLLMENTS ||--o{ STUDY_PLANS : follows
    STUDENTS ||--o{ PROGRESS_RECORDS : accumulates
    LEARNING_STANDARDS ||--o{ PROGRESS_RECORDS : measured_against
    ACTIVITIES ||--o{ ATTEMPTS : generates
    STUDENTS ||--o{ ATTEMPTS : submits

    STUDENTS ||--o{ TUTOR_SESSIONS : opens
    TUTOR_SESSIONS ||--o{ TUTOR_MESSAGES : contains
    TUTOR_MESSAGES ||--o{ MODERATION_EVENTS : checked_by
    TUTOR_MESSAGES ||--o{ CITATIONS : grounded_with

    HOUSEHOLDS ||--o{ SUBSCRIPTIONS : owns
    SUBSCRIPTIONS ||--o{ PAYMENTS : collects
    SUBSCRIPTIONS ||--o{ INVOICES : bills

    USERS ||--o{ CONSENTS : gives
    USERS ||--o{ AUDIT_LOGS : performs
```

See [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma) for the
full field-level definition.

## AI tutor request flow

```mermaid
sequenceDiagram
    actor Student
    participant Web as Web (TutorChatPanel)
    participant API as API (TutorController)
    participant Mod as Moderation (@kpm/ai)
    participant RAG as RagService
    participant LLM as AI provider
    participant DB as Postgres

    Student->>Web: type question
    Web->>API: POST /tutor/sessions/:id/messages (SSE)
    API->>DB: persist student message
    API->>Mod: moderateInput()
    alt blocked / escalate
        Mod-->>API: BLOCK + safe message
        API->>DB: moderation event + intervention flag
        API-->>Web: event: blocked
    else allowed
        API->>RAG: retrieve(query, filter by variant)
        RAG->>LLM: embed(query)
        RAG->>DB: pgvector ANN search (filtered)
        DB-->>RAG: top-k chunks
        API->>LLM: generateTutorReply(stream)
        loop tokens
            LLM-->>API: token
            API-->>Web: event: token
        end
        LLM-->>API: final JSON (answer, citations, mastery_signal)
        API->>Mod: moderateOutput()
        API->>DB: assistant message + citations + moderation
        API-->>Web: event: final
    end
```

## Performance-sensitive indexes

Declared in `schema.prisma` (`@@index`) and the SQL migrations:

- `EmbeddingChunk (curriculumVersionCode, schoolType, language, dlpMode)` + IVFFlat ANN.
- `Attempt (studentId, submittedAt DESC)`.
- `TutorMessage (tutorSessionId, createdAt)`.
- Partial index on `ModerationEvent` where `policyResult <> 'PASS'`.
