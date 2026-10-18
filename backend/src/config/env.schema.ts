import { z } from 'zod';

const postgresUrl = z.url().refine((v) => /^postgres(ql)?:/.test(v), 'Expected PostgreSQL URL');
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    HOST: z.enum(['127.0.0.1', '0.0.0.0']).optional(),
    DATABASE_URL: postgresUrl,
    FRONTEND_URL: z.url(),
    FRONTEND_ORIGINS: z
      .string()
      .min(1)
      .transform((v) => v.split(',').map((x) => z.url().parse(x.trim()))),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(168),
    MAIL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    EMAIL_DRIVER: z.enum(['mailbox', 'resend']).default('mailbox'),
    RESEND_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
    EMAIL_FROM: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
    MAILBOX_DIR: z.string().default('.local/mailbox'),
    LOG_LEVEL: z.enum(['silent', 'debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.EMAIL_DRIVER === 'mailbox') {
      ctx.addIssue({
        code: 'custom',
        message:
          'Production requires an external email transport. Development mailbox must not be deployed.',
      });
    }
    if (env.EMAIL_DRIVER === 'resend') {
      if (!env.RESEND_API_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_API_KEY'],
          message: 'Resend API key is required for the Resend transport.',
        });
      if (!env.EMAIL_FROM)
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_FROM'],
          message: 'A verified sender email is required for the Resend transport.',
        });
    }
    if (env.NODE_ENV === 'production') {
      for (const value of [env.FRONTEND_URL, ...env.FRONTEND_ORIGINS]) {
        if (new URL(value).protocol !== 'https:')
          ctx.addIssue({
            code: 'custom',
            message: 'Production frontend URLs and origins must use HTTPS.',
          });
      }
    }
    for (const origin of env.FRONTEND_ORIGINS) {
      if (new URL(origin).origin !== origin)
        ctx.addIssue({
          code: 'custom',
          message: 'FRONTEND_ORIGINS must contain origins without paths or trailing slashes',
        });
    }
  })
  .transform((env) => ({
    ...env,
    HOST: env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  }));
export type Config = z.infer<typeof envSchema>;
