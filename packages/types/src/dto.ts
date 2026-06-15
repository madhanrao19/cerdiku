import { z } from 'zod';
import {
  ROLES,
  LEVELS,
  SCHOOL_TYPES,
  LANGUAGES,
  DLP_MODES,
  TUTOR_MODES,
  MASTERY_SIGNALS,
} from './enums.js';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerParentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  householdName: z.string().min(1).max(120),
  acceptPrivacyNotice: z.literal(true),
  locale: z.string().default('en-MY'),
});
export type RegisterParentInput = z.infer<typeof registerParentSchema>;

export const registerStudentSchema = z.object({
  fullName: z.string().min(1).max(120),
  // Child may log in without email — username is optional/local-only.
  username: z.string().min(3).max(40).optional(),
  password: z.string().min(6).max(128).optional(),
  dob: z.coerce.date(),
  level: z.enum(LEVELS),
  languagePref: z.enum(LANGUAGES).default('BM'),
  dlpMode: z.enum(DLP_MODES).default('NONE'),
  schoolType: z.enum(SCHOOL_TYPES).default('HOMESCHOOL'),
});
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1), // email | phone | child username
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Curriculum query
// ---------------------------------------------------------------------------

export const subjectQuerySchema = z.object({
  level: z.enum(LEVELS).optional(),
  schoolType: z.enum(SCHOOL_TYPES).optional(),
  language: z.enum(LANGUAGES).optional(),
  dlpMode: z.enum(DLP_MODES).optional(),
  curriculumVersionCode: z.string().optional(),
});
export type SubjectQuery = z.infer<typeof subjectQuerySchema>;

// ---------------------------------------------------------------------------
// Activities / attempts
// ---------------------------------------------------------------------------

export const submitAttemptSchema = z.object({
  responses: z.array(
    z.object({
      questionId: z.string(),
      answer: z.union([z.string(), z.number(), z.array(z.string())]),
    }),
  ),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

// ---------------------------------------------------------------------------
// Tutor
// ---------------------------------------------------------------------------

export const openTutorSessionSchema = z.object({
  studentId: z.string().uuid(),
  lessonId: z.string().uuid().optional(),
  mode: z.enum(TUTOR_MODES).default('explain'),
});
export type OpenTutorSessionInput = z.infer<typeof openTutorSessionSchema>;

export const tutorMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  mode: z.enum(TUTOR_MODES).optional(),
});
export type TutorMessageInput = z.infer<typeof tutorMessageSchema>;

// The structured object the tutor model must return (post-validated).
export const tutorReplySchema = z.object({
  answer_markdown: z.string(),
  mastery_signal: z.enum(MASTERY_SIGNALS),
  needs_parent_or_admin_review: z.boolean(),
  citations: z.array(z.string()),
});
export type TutorReply = z.infer<typeof tutorReplySchema>;

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

export const studyPlanSchema = z.object({
  enrollmentId: z.string().uuid(),
  pacingMode: z.enum(['self_paced', 'scheduled']).default('self_paced'),
  weeklyTargetMinutes: z.number().int().min(0).max(3000).default(120),
  schedule: z.record(z.string(), z.unknown()).optional(),
});
export type StudyPlanInput = z.infer<typeof studyPlanSchema>;

// ---------------------------------------------------------------------------
// Admin / content
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES),
  password: z.string().min(8),
  householdId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const publishContentSchema = z.object({
  lessonId: z.string().uuid(),
  publish: z.boolean(),
});
export type PublishContentInput = z.infer<typeof publishContentSchema>;

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export const checkoutSessionSchema = z.object({
  planCode: z.string().min(1),
  householdId: z.string().uuid(),
});
export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export const privacyRequestSchema = z.object({
  subjectUserId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});
export type PrivacyRequestInput = z.infer<typeof privacyRequestSchema>;
