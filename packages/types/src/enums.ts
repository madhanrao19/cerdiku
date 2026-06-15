// Single source of truth for the KPM domain enums. These MUST stay in sync with
// apps/api/prisma/schema.prisma. Kept as const-arrays so they can be reused both
// as TS unions and as Zod enums.

export const ROLES = [
  'PARENT',
  'STUDENT',
  'ADMIN',
  'CONTENT_ADMIN',
  'SAFETY_REVIEWER',
] as const;
export type Role = (typeof ROLES)[number];

export const LEVELS = [
  'PRESCHOOL',
  'PRIMARY',
  'LOWER_SECONDARY',
  'UPPER_SECONDARY',
] as const;
export type Level = (typeof LEVELS)[number];

export const SCHOOL_TYPES = [
  'SK',
  'SJKC',
  'SJKT',
  'SMK',
  'SMKA',
  'SABK',
  'HOMESCHOOL',
  'PRIVATE',
] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const LANGUAGES = ['BM', 'EN', 'ZH', 'TA', 'OTHER'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DLP_MODES = ['NONE', 'BILINGUAL', 'DLP_SUBJECT_VARIANT'] as const;
export type DlpMode = (typeof DLP_MODES)[number];

export const ASSESSMENT_MODES = ['MONOLINGUAL', 'BILINGUAL'] as const;
export type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

export const MASTERY_BANDS = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type MasteryBand = (typeof MASTERY_BANDS)[number];

// Lowercase mastery signal used in the AI tutor JSON contract (the model emits
// lowercase). Mapped to the uppercase DB `MasteryBand` server-side.
export const MASTERY_SIGNALS = ['none', 'low', 'medium', 'high'] as const;
export type MasterySignal = (typeof MASTERY_SIGNALS)[number];

export const TUTOR_MODES = [
  'explain',
  'hint',
  'socratic',
  'worked_example',
  'quiz_me',
  'revision_plan',
] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];

export const MODERATION_RESULTS = ['PASS', 'FLAG', 'BLOCK'] as const;
export type ModerationResult = (typeof MODERATION_RESULTS)[number];

export const CONSENT_TYPES = [
  'PRIVACY_NOTICE',
  'PARENTAL_AI_USE',
  'DLP_PARTICIPATION',
  'MARKETING',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const PAYMENT_PROVIDERS = ['billplz', 'curlec', 'stripe'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const AI_PROVIDERS = ['openai', 'azure-openai', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

// PBD Tahap Penguasaan (mastery levels 1..6) used in parent-facing reports.
export const TAHAP_PENGUASAAN = [1, 2, 3, 4, 5, 6] as const;
export type TahapPenguasaan = (typeof TAHAP_PENGUASAAN)[number];
