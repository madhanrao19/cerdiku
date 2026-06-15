import { z } from 'zod';

// Centralized, validated environment. Import `loadEnv()` once at process start;
// it throws a readable error if anything required is missing or malformed.

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  SESSION_COOKIE_DOMAIN: z.string().default('localhost'),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('ap-southeast-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('kpm-media'),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),

  AI_PROVIDER: z.enum(['openai', 'azure-openai', 'anthropic']).default('anthropic'),
  OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(['billplz', 'curlec', 'stripe']).default('billplz'),
  BILLPLZ_API_KEY: z.string().optional(),
  BILLPLZ_COLLECTION_ID: z.string().optional(),
  CURLEC_KEY_ID: z.string().optional(),
  CURLEC_KEY_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  MAIL_FROM: z.string().default('no-reply@cerdiku.local'),
  SMTP_URL: z.string().optional(),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

// Feature flags — used to gate language / DLP rollouts (brief item #5).
// Backed by env for now; swap for a DB/remote-config table later without
// changing call sites.
export interface FeatureFlags {
  languages: { ZH: boolean; TA: boolean; OTHER: boolean };
  dlpBilingualAssessments: boolean;
  liveTutoring: boolean;
  simulations: boolean;
}

export function loadFeatureFlags(source: NodeJS.ProcessEnv = process.env): FeatureFlags {
  const on = (k: string, dflt = false) =>
    source[k] === undefined ? dflt : source[k] === 'true' || source[k] === '1';
  return {
    languages: {
      ZH: on('FLAG_LANG_ZH', true),
      TA: on('FLAG_LANG_TA', true),
      OTHER: on('FLAG_LANG_OTHER', false),
    },
    dlpBilingualAssessments: on('FLAG_DLP_BILINGUAL', false),
    liveTutoring: on('FLAG_LIVE_TUTORING', false),
    simulations: on('FLAG_SIMULATIONS', false),
  };
}
