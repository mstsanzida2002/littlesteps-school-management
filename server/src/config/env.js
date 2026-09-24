import { config } from 'dotenv';
import { z } from 'zod';

// Load server/.env (npm workspace scripts run with cwd = server/).
// Real environment variables always win over the file. Tests never read .env so they stay
// deterministic; vitest.config.js provides their values.
if (process.env.NODE_ENV !== 'test') config({ quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().trim().optional(),
    // Comma-separated list of allowed browser origins for direct (non-proxied) API calls.
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    // Number of reverse proxies in front of the app (Vercel rewrite + Render = 2 in production).
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

    // --- Auth ---
    JWT_ACCESS_SECRET: z
      .string({ error: 'JWT_ACCESS_SECRET is required' })
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'Use a duration like 15m')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    // 'true'/'false' strings (z.coerce.boolean would treat 'false' as true).
    SELF_REGISTRATION_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    // --- Email to guardians (FR-NOT-05, optional) ---
    EMAIL_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // smtp = Nodemailer; resend = HTTPS API (for hosts that block SMTP); console = log only
    EMAIL_PROVIDER: z.enum(['smtp', 'resend', 'console']).default('console'),
    EMAIL_FROM: z.string().trim().optional(),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const require = (key, why) => {
      if (!val[key])
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required ${why}` });
    };
    if (val.EMAIL_ENABLED && val.EMAIL_PROVIDER !== 'console') {
      require('EMAIL_FROM', 'when EMAIL_ENABLED=true');
      if (val.EMAIL_PROVIDER === 'smtp') require('SMTP_HOST', 'for EMAIL_PROVIDER=smtp');
      if (val.EMAIL_PROVIDER === 'resend') require('RESEND_API_KEY', 'for EMAIL_PROVIDER=resend');
    }
    if (val.NODE_ENV === 'production' && !val.MONGODB_URI) {
      ctx.addIssue({
        code: 'custom',
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI is required in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Logger depends on env, so write directly to stderr here.
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = Object.freeze({
  ...raw,
  CLIENT_ORIGINS: raw.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isDev: raw.NODE_ENV === 'development',
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
});
