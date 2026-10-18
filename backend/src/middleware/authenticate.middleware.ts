import type { RequestHandler } from 'express';
import type { Database } from '../infrastructure/database/client.js';
import { digest } from '../lib/security.js';
import { AppError } from '../lib/errors.js';

export function authenticate(db: Database): RequestHandler {
  return async (req, _res, next) => {
    const secret: unknown = req.cookies?.lms_session;
    if (typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret))
      throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const session = await db.session.findUnique({
      where: { tokenHash: digest(secret) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive)
      throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const user = session.user;
    if (!user.emailVerifiedAt || (user.role === 'LECTURER' && !user.lecturerApprovedAt))
      throw new AppError(403, 'ACCESS_PENDING', 'Account access is pending.');
    req.actor = { id: user.id, role: user.role, sessionId: session.id };
    next();
  };
}
