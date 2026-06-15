# AI tutor design

RAG-first, fine-tuning-later. The tutor is a teaching copilot tied to the
curriculum graph, not a free-form chatbot.

## Provider abstraction

`packages/ai` exposes one interface, `AiProviderClient`:

- `generateTutorReply(req)` → async-iterable of tokens + `.final()` structured reply
- `classifyRisk(text)` → moderation classification
- `generatePracticeSet(req)` → original KPM-aligned items (no verbatim copyright)
- `summarizeProgress(input)` → parent-facing narrative
- `embed(texts)` → vectors for RAG

`createAiProvider(env)` selects Anthropic / OpenAI / Azure OpenAI by `AI_PROVIDER`,
**falling back to a deterministic `MockProvider` when no key is set** so the
platform runs and tests pass offline. Anthropic has no embeddings endpoint, so
the factory composes embeddings from OpenAI/Azure (or mock) independently.

## Pipeline (TutorService.streamMessage)

1. Persist the student message (educational record).
2. **Pre-moderation** (`moderateInput`) — block/escalate self-harm, abuse,
   sexual content, dangerous instructions. On block, return a safe message
   (Talian Kasih 15999) and raise an intervention flag.
3. **Retrieval** — `RagService.retrieve` does filtered pgvector ANN search
   scoped to the student's `curriculum version + school_type + language + DLP`.
4. **Generation** — streamed; system prompt is the versioned, child-safe
   `MALAYSIA_KPM_TUTOR_SYSTEM` (cached on Anthropic to control cost).
5. **Post-moderation** of the output.
6. Persist assistant message + citations + moderation events; set `needsReview`
   when the model or moderation flags it.

## Hallucination mitigation

| Risk | Mitigation |
|------|------------|
| Wrong curriculum fact | retrieval filtered by version + school_type + language + DLP |
| Confident fabrication | must cite retrieved chunks; says "not sure from lesson materials" otherwise |
| Unsafe child interaction | pre/post moderation, escalation flags, parent/admin review |
| Output inconsistency | structured JSON contract validated server-side (`tutorReplySchema`) |
| Cost blowout | prompt caching on the static system prompt |

## Evaluation

QA is **vendor-agnostic and internally owned** (the legacy OpenAI Evals platform
is being retired). Build a dataset-driven bench scoring: groundedness, syllabus
alignment, bilingual fidelity (DLP), safety precision/recall, pedagogical
quality, latency, and cost. `packages/ai/src/ai.test.ts` seeds the harness with
grounding + moderation assertions.

## Embedding model

Default `text-embedding-3-small` (1536 dims) — matches the `vector(1536)` column.
Changing models requires altering the column dimension + reindexing.
