import { z } from 'zod';
export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const passwordSchema = z.string().min(12).max(128);
export const registerSchema = z.strictObject({
  email: emailSchema,
  name: z.string().trim().min(2).max(100),
  password: passwordSchema,
  role: z.enum(['STUDENT', 'LECTURER']).default('STUDENT'),
});
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const emailRequestSchema = z.strictObject({ email: emailSchema });
export const tokenSchema = z.strictObject({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const resetSchema = tokenSchema.extend({ password: passwordSchema });
