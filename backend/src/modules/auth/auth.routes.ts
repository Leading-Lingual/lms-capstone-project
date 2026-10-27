import { Router, type CookieOptions } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Database } from '../../infrastructure/database/client.js';
import type { Config } from '../../config/env.schema.js';
import { authenticate } from '../../middleware/authenticate.middleware.js';
import { ok } from '../../lib/http.js';
import { createAuthService, safeUser } from './auth.service.js';
import {
  emailRequestSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
} from './auth.schema.js';

export function authRoutes(db: Database, config: Config) {
  const router = Router();
  const service = createAuthService(db, config);
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts. Try again later.',
        },
        meta: { requestId: req.requestId },
      }),
  });
  const cookie: CookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  router.post('/register', limit, async (req, res) => {
    await service.register(registerSchema.parse(req.body), req.requestId);
    ok(
      req,
      res,
      {
        message:
          'If registration is available for this email, a verification message will be sent. Existing users can sign in or request recovery.',
      },
      202,
    );
  });
  router.post('/verify-email', limit, async (req, res) => {
    await service.verifyEmail(tokenSchema.parse(req.body).token, req.requestId);
    ok(req, res, { message: 'Email verified.' });
  });
  for (const [path, purpose] of [
    ['resend-verification', 'VERIFY_EMAIL'],
    ['forgot-password', 'RESET_PASSWORD'],
  ] as const) {
    router.post(`/${path}`, limit, async (req, res) => {
      await service.requestLink(emailRequestSchema.parse(req.body).email, purpose);
      ok(req, res, { message: 'If the account is eligible, an email will be sent.' }, 202);
    });
  }
  router.post('/reset-password', limit, async (req, res) => {
    const input = resetSchema.parse(req.body);
    await service.resetPassword(input.token, input.password, req.requestId);
    res.clearCookie('lms_session', cookie);
    ok(req, res, { message: 'Password reset. Sign in with your new password.' });
  });
  router.post('/login', limit, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await service.login(input.email, input.password);
    res.cookie('lms_session', result.secret, { ...cookie, expires: result.expiresAt });
    ok(req, res, { user: result.user });
  });
  router.post('/logout', authenticate(db), async (req, res) => {
    await service.logout(req.actor!.sessionId);
    res.clearCookie('lms_session', cookie);
    ok(req, res, { message: 'Signed out.' });
  });
  router.get('/me', authenticate(db), async (req, res) => {
    const user = await db.user.findUniqueOrThrow({ where: { id: req.actor!.id } });
    ok(req, res, safeUser(user));
  });
  return router;
}
