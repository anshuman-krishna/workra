import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 chars'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // storage: s3-compatible (aws s3, cloudflare r2, minio).
  // STORAGE_DRIVER=local stores blobs on disk under STORAGE_LOCAL_DIR; useful for dev without cloud creds.
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().url().optional(),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_SIGNED_URL_TTL: z.coerce.number().int().positive().default(900),
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  // ai layer: optional. if ANTHROPIC_API_KEY is unset the ai service falls back
  // to the deterministic narrative / suggestion builders so nothing 500s.
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-haiku-4-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(400),
  // error tracking: optional. set to enable sentry or compatible service.
  SENTRY_DSN: z.string().url().optional(),
}).superRefine((data, ctx) => {
  if (data.STORAGE_DRIVER === 's3') {
    const required = ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'] as const;
    for (const key of required) {
      if (!data[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
