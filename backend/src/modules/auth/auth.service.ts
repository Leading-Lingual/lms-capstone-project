import { Prisma, type TokenPurpose, type User } from '../../generated/prisma/client.js';
import type { Database } from '../../infrastructure/database/client.js';
import { transaction } from '../../infrastructure/database/transaction.js';
import type { Config } from '../../config/env.schema.js';
import { AppError } from '../../lib/errors.js';
import { digest, encrypt, hashPassword, token, verifyPassword } from '../../lib/security.js';
import { audit } from '../audit/audit.service.js';
import type { registerSchema } from './auth.schema.js';
import type { z } from 'zod';

export const safeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  emailVerifiedAt: user.emailVerifiedAt,
  lecturerApprovedAt: user.lecturerApprovedAt,
});
export function createAuthService(db: Database, config: Config) {
  let dummyHash: Promise<string> | undefined;
  async function issue(tx: Prisma.TransactionClient, user: User, purpose: TokenPurpose) {
    const secret = token();
    await tx.authToken.updateMany({
      where: { userId: user.id, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.authToken.create({
      data: {
        userId: user.id,
        tokenHash: digest(secret),
        purpose,
        expiresAt: new Date(Date.now() + (purpose === 'VERIFY_EMAIL' ? 24 : 1) * 3600000),
      },
    });
    const route = purpose === 'VERIFY_EMAIL' ? 'verify-email' : 'reset-password';
    const link = new URL(
      route,
      config.FRONTEND_URL.endsWith('/') ? config.FRONTEND_URL : `${config.FRONTEND_URL}/`,
    );
    // Fragment values are not sent to web servers or referrer logs by the browser.
    link.hash = `token=${secret}`;
    await tx.emailJob.create({
      data: {
        payload: encrypt(
          {
            to: user.email,
            subject:
              purpose === 'VERIFY_EMAIL'
                ? 'Verify your Thriving in Tech account'
                : 'Reset your Thriving in Tech password',
            text: `Open ${link.toString()} to continue. This link is single-use and expires. If you did not request this, ignore this message.`,
          },
          config.MAIL_ENCRYPTION_KEY,
        ),
      },
    });
  }
  async function consume(tx: Prisma.TransactionClient, secret: string, purpose: TokenPurpose) {
    const stored = await tx.authToken.findUnique({ where: { tokenHash: digest(secret) } });
    if (!stored || stored.purpose !== purpose || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new AppError(400, 'TOKEN_INVALID', 'The link is invalid or expired.');
    }
    const result = await tx.authToken.updateMany({
      where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!result.count) throw new AppError(400, 'TOKEN_INVALID', 'The link is invalid or expired.');
    const user = await tx.user.findUniqueOrThrow({ where: { id: stored.userId } });
    if (!user.isActive) throw new AppError(400, 'TOKEN_INVALID', 'The link is invalid or expired.');
    return user;
  }
  return {
    async register(input: z.infer<typeof registerSchema>, requestId: string) {
      const passwordHash = await hashPassword(input.password);
      try {
        await transaction(db, async (tx) => {
          const user = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              role: input.role,
              passwordHash,
            },
          });
          await issue(tx, user, 'VERIFY_EMAIL');
          await audit(tx, user.id, requestId, 'USER_REGISTERED', user.id);
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
          throw error;
      }
    },
    async requestLink(email: string, purpose: TokenPurpose) {
      await transaction(db, async (tx) => {
        const user = await tx.user.findUnique({ where: { email } });
        if (!user || !user.isActive || (purpose === 'VERIFY_EMAIL' && user.emailVerifiedAt)) return;
        await issue(tx, user, purpose);
      });
    },
    async verifyEmail(secret: string, requestId: string) {
      await transaction(db, async (tx) => {
        const user = await consume(tx, secret, 'VERIFY_EMAIL');
        await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
        await audit(tx, user.id, requestId, 'EMAIL_VERIFIED', user.id);
      });
    },
    async resetPassword(secret: string, password: string, requestId: string) {
      const passwordHash = await hashPassword(password);
      await transaction(db, async (tx) => {
        const user = await consume(tx, secret, 'RESET_PASSWORD');
        await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.authToken.updateMany({
          where: { userId: user.id, purpose: 'RESET_PASSWORD', usedAt: null },
          data: { usedAt: new Date() },
        });
        await audit(tx, user.id, requestId, 'PASSWORD_RESET', user.id);
      });
    },
    async login(email: string, password: string) {
      const user = await db.user.findUnique({ where: { email } });
      if (!user && !dummyHash) dummyHash = hashPassword(token());
      const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash!));
      if (!user || !valid || !user.isActive)
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      if (!user.emailVerifiedAt)
        throw new AppError(403, 'EMAIL_UNVERIFIED', 'Verify your email before signing in.');
      if (user.role === 'LECTURER' && !user.lecturerApprovedAt)
        throw new AppError(
          403,
          'LECTURER_PENDING',
          'Lecturer access is awaiting administrator approval.',
        );
      const secret = token();
      const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600000);
      await db.session.create({ data: { tokenHash: digest(secret), userId: user.id, expiresAt } });
      return { user: safeUser(user), secret, expiresAt };
    },
    async logout(sessionId: string) {
      await db.session.deleteMany({ where: { id: sessionId } });
    },
  };
}
