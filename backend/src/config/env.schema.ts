import { z } from 'zod';
import { parseEmailSender } from '../infrastructure/email/sender.js';

const postgresUrl = z.url().refine((v) => /^postgres(ql)?:/.test(v), 'Expected PostgreSQL URL');
const frontendUrl = z
  .url()
  .refine(
    (value) => !value.includes(',') && /^https?:\/\//.test(value),
    'Expected a single HTTP or HTTPS frontend URL, not a comma-separated list.',
  );
const localFrontendOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
]);
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    HOST: z.enum(['127.0.0.1', '0.0.0.0']).optional(),
    DATABASE_URL: postgresUrl,
    FRONTEND_URL: frontendUrl,
    FRONTEND_ORIGINS: z
      .string()
      .min(1)
      .transform((v) => v.split(',').map((x) => x.trim()))
      .pipe(z.array(frontendUrl)),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(168),
    MAIL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    EMAIL_PROVIDER: z.enum(['mailbox', 'resend', 'brevo']).optional(),
    EMAIL_DRIVER: z.enum(['mailbox', 'resend', 'brevo']).default('mailbox'),
    BREVO_API_KEY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().trim().min(1).optional(),
    ),
    BREVO_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
    RESEND_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
    EMAIL_FROM: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .trim()
        .max(320)
        .refine(
          (value) => !!parseEmailSender(value),
          'Expected an email address or Name <email@example.com>.',
        )
        .optional(),
    ),
    MAILBOX_DIR: z.string().default('.local/mailbox'),
    LOG_LEVEL: z.enum(['silent', 'debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((env, ctx) => {
    const provider = env.EMAIL_PROVIDER ?? env.EMAIL_DRIVER;
    if (env.NODE_ENV === 'production' && provider === 'mailbox') {
      ctx.addIssue({
        code: 'custom',
        message:
          'Production requires an external email transport. Development mailbox must not be deployed.',
      });
    }
    if (provider === 'resend') {
      if (!env.RESEND_API_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_API_KEY'],
          message: 'Resend API key is required for the Resend transport.',
        });
    }
    if (provider === 'brevo' && !env.BREVO_API_KEY)
      ctx.addIssue({
        code: 'custom',
        path: ['BREVO_API_KEY'],
        message: 'Brevo API key is required for the Brevo transport.',
      });
    if (provider !== 'mailbox') {
      if (!env.EMAIL_FROM)
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_FROM'],
          message: 'A verified sender email is required for the selected email transport.',
        });
    }
    if (env.NODE_ENV === 'production') {
      for (const [field, values] of [
        ['FRONTEND_URL', [env.FRONTEND_URL]],
        ['FRONTEND_ORIGINS', env.FRONTEND_ORIGINS],
      ] as const) {
        for (const value of values) {
          if (!URL.canParse(value)) continue;
          const url = new URL(value);
          if (url.protocol !== 'https:' && !localFrontendOrigins.has(url.origin))
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message:
                'Use HTTPS, or HTTP localhost on port 3000, 5173, or 8081 for frontend development.',
            });
        }
      }
    }
    for (const origin of env.FRONTEND_ORIGINS) {
      if (!URL.canParse(origin) || new URL(origin).origin !== origin)
        ctx.addIssue({
          code: 'custom',
          path: ['FRONTEND_ORIGINS'],
          message: 'FRONTEND_ORIGINS must contain origins without paths or trailing slashes',
        });
    }
  })
  .transform((env) => ({
    ...env,
    EMAIL_PROVIDER: env.EMAIL_PROVIDER ?? env.EMAIL_DRIVER,
    EMAIL_DRIVER: env.EMAIL_PROVIDER ?? env.EMAIL_DRIVER,
    HOST: env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  }));
export type Config = z.infer<typeof envSchema>;
