# Privacy & safety

This is a youth-facing product handling education records, tutoring
conversations, and financial data. Privacy, child safety, and copyright are
treated as product features, not post-launch hygiene.

## Product & legal posture

- Ship as a **KPM-aligned subscription learning platform**, not a registered
  school. Avoid claims of KPM approval, official certification, or examination
  authority, and avoid presenting the product as a home-school registration
  shortcut. (Promoting an unregistered educational institution is restricted
  under the Education Act 1996.)
- The tutor system prompt explicitly forbids KPM-approval / certification claims.

## Copyright

Ship **only original** explanations, examples, questions, and media you own or
license. Ingest curriculum *metadata* and standard references — never bulk-copy
KPM textbook text or PDFs. The seed contains original placeholder content only.

## PDPA (Act 709) alignment

- **Consent** captured at signup (`Consent` records, versioned); parental
  consent gates child AI use and DLP participation.
- **Data subject rights**: `/privacy/export` assembles a user's records;
  `/privacy/delete-request` anonymizes (soft-delete + audit) so reporting history
  is preserved.
- **Audit trail**: `AuditLog` records auth, admin, content, privacy, and
  intervention actions.
- **Cross-border transfer**: keep a vendor register and run a transfer impact
  assessment before sending personal data to any non-Malaysian AI/payment
  provider (Section 129). The provider abstraction makes the data-flow boundary
  explicit and swappable.
- **DPO**: appoint/register a DPO once thresholds are met (≈ 20,000 data
  subjects, or 10,000 with sensitive data, or systematic monitoring).
- **Breach**: maintain a breach notification playbook.

## Child-safe AI

- Pre- and post-generation **moderation** on every tutor turn.
- Risk routing for self-harm, abuse, sexual exploitation, dangerous
  instructions → safe response (Talian Kasih 15999) + intervention flag +
  Safety Reviewer queue + parent visibility.
- No emotional-dependency language, secrecy, or unnecessary PII requests.
- Raw child conversation logs are never exposed by public APIs — only via
  controlled, policy-checked admin/parent routes.
- Recommendation traces are stored for explainability; no opaque high-stakes
  automated decisions without human override.

## API hardening

- **Rate limiting** (`@nestjs/throttler`): 120 req/min/IP global; stricter on
  auth (login 8, register 5) and tutor (20) per minute; webhook exempt (HMAC-gated).
- **Security headers** (`@fastify/helmet`) at the app layer (HSTS, nosniff,
  frame-deny, etc.), independent of the reverse proxy.
- **Auth**: Argon2id hashing, rotating refresh tokens (hashed at rest), httpOnly
  + SameSite cookies, global RBAC guard.

## Accessibility

Target WCAG 2.2 AA: keyboard navigation, captions/transcripts, alt text,
contrast, reduced-motion (implemented in `globals.css`), and accessible forms.
