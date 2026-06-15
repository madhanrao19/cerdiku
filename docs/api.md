# API reference

Base path: `/api`. Auth via httpOnly cookies (`access_token`, `refresh_token`)
or `Authorization: Bearer`. RBAC enforced by a global guard; routes marked
`@Public()` skip auth. All bodies are validated against `@kpm/types` Zod schemas.

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/auth/register-parent` | Public | Parent signup + household + consent |
| POST | `/auth/register-student` | Parent/Admin | Create child under household |
| POST | `/auth/login` | Public | Email/phone + password |
| POST | `/auth/refresh` | Public (cookie) | Rotate token pair |
| POST | `/auth/logout` | Public | Revoke refresh session |
| GET | `/auth/me` | Any | Current profile + role |
| GET | `/curriculum/versions` | Public | Active + upcoming versions |
| GET | `/school-profiles` | Public | Filter level/schoolType/medium/DLP |
| GET | `/subjects` | Public | Subject **variants** by filter |
| GET | `/subjects/:id/standards` | Public | Standards tree + lessons |
| GET | `/lessons/:id` | Public | Lesson blocks + media + activities |
| POST | `/activities/:id/start` | Student | Begin an attempt |
| POST | `/attempts/:id/submit` | Student | Submit answers; auto-mark + progress |
| GET | `/students/:id/progress` | Parent/Admin/Student | Mastery records |
| GET | `/reports/pbd/:studentId` | Parent/Admin | PBD report + AI summary |
| POST | `/tutor/sessions` | Student/Parent | Open tutor session |
| POST | `/tutor/sessions/:id/messages` | Student/Parent | **SSE** streamed reply |
| GET | `/parents/dashboard` | Parent/Admin | Children, plans, flags, invoices |
| POST | `/parents/study-plans` | Parent/Admin | Set pacing/targets |
| GET | `/admin/users` | Admin | List users |
| POST | `/admin/users` | Admin | Create user |
| GET | `/admin/content` | Admin/Content | List lessons |
| POST | `/admin/content/import` | Admin/Content | Import curriculum metadata |
| POST | `/admin/content/publish` | Admin/Content | Publish/unpublish lesson |
| GET | `/admin/moderation/queue` | Admin/Safety | Flagged tutor messages |
| GET | `/admin/webhooks/log` | Admin | Webhook event log |
| GET | `/analytics/cohorts` | Admin | Cohort dashboard metrics |
| POST | `/billing/checkout-session` | Parent/Admin | Start subscription |
| POST | `/webhooks/payments/provider` | Public (HMAC) | Payment callback (idempotent) |
| POST | `/privacy/export` | Parent/Admin | Data access request |
| POST | `/privacy/delete-request` | Parent/Admin | Anonymization request |
| GET | `/health` | Public | Liveness + DB check |

## Rate limiting & security headers

- Global limit: **120 req/min/IP** (`@nestjs/throttler`, `ThrottlerGuard` runs
  before auth). Returns `429` when exceeded.
- Tighter per-route overrides: `login` 8/min, `register-parent` 5/min
  (anti-brute-force), tutor `messages` 20/min (LLM cost control).
- The payment webhook is `@SkipThrottle()` — gateways legitimately burst/retry;
  HMAC is the gate there.
- For multi-instance deployments swap the in-memory store for
  `@nest-lab/throttler-storage-redis` so limits are shared across nodes.
- Security headers (`@fastify/helmet`) are applied at the app layer so they hold
  on every host, not only behind the Caddy proxy. CSP is delegated to the edge
  since the API serves JSON.

## SSE event stream (`/tutor/sessions/:id/messages`)

Events: `token` (incremental text), `final` (`{ answer_markdown, mastery_signal,
needs_parent_or_admin_review, citations[] }`), `blocked` (safe message after a
moderation BLOCK), `error`.

> Raw child AI conversation logs are never exposed by public endpoints — only
> via controlled server-side admin/parent routes after policy checks.
