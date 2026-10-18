import { z } from 'zod';
import type { Database } from '../../infrastructure/database/client.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { transaction } from '../../infrastructure/database/transaction.js';
import { AppError } from '../../lib/errors.js';
import { audit } from '../audit/audit.service.js';
import { safeUser } from '../auth/auth.service.js';

export const userStateSchema = z
  .strictObject({
    role: z.enum(['STUDENT', 'LECTURER', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (v) => v.role !== undefined || v.isActive !== undefined,
    'Supply a role or account status',
  );
export async function requireAdmin(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor?.isActive || !actor.emailVerifiedAt || actor.role !== 'ADMIN')
    throw new AppError(403, 'FORBIDDEN', 'Administrator access is required.');
}
export function createUsersService(db: Database) {
  return {
    async approveLecturer(id: string, actorId: string, requestId: string) {
      return transaction(db, async (tx) => {
        await requireAdmin(tx, actorId);
        const user = await tx.user.findUnique({ where: { id } });
        if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
        if (user.role !== 'LECTURER' || !user.isActive || !user.emailVerifiedAt)
          throw new AppError(
            409,
            'INVALID_STATE',
            'Only an active verified lecturer can be approved.',
          );
        if (user.lecturerApprovedAt) return safeUser(user);
        const updated = await tx.user.update({
          where: { id },
          data: { lecturerApprovedAt: new Date() },
        });
        await audit(tx, actorId, requestId, 'LECTURER_APPROVED', id);
        return safeUser(updated);
      });
    },
    async updateState(
      id: string,
      input: z.infer<typeof userStateSchema>,
      actorId: string,
      requestId: string,
    ) {
      return transaction(db, async (tx) => {
        await requireAdmin(tx, actorId);
        const user = await tx.user.findUnique({ where: { id } });
        if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
        const nextRole = input.role ?? user.role;
        const nextActive = input.isActive ?? user.isActive;
        if (nextRole === 'ADMIN' && !user.emailVerifiedAt)
          throw new AppError(
            409,
            'INVALID_STATE',
            'Verify email before granting administrator access.',
          );
        if (user.role === 'ADMIN' && user.isActive && (nextRole !== 'ADMIN' || !nextActive)) {
          const count = await tx.user.count({
            where: { role: 'ADMIN', isActive: true, emailVerifiedAt: { not: null } },
          });
          if (count <= 1)
            throw new AppError(
              409,
              'LAST_ADMIN',
              'The last active administrator cannot be removed.',
            );
        }
        const changedRole = nextRole !== user.role;
        const updated = await tx.user.update({
          where: { id },
          data: {
            role: nextRole,
            isActive: nextActive,
            ...(changedRole ? { lecturerApprovedAt: null } : {}),
          },
        });
        if (changedRole || !nextActive) await tx.session.deleteMany({ where: { userId: id } });
        if (changedRole && nextRole !== 'STUDENT')
          await tx.enrolment.deleteMany({ where: { studentId: id } });
        if (changedRole && nextRole !== 'LECTURER')
          await tx.courseLecturer.deleteMany({ where: { lecturerId: id } });
        await audit(tx, actorId, requestId, 'USER_ACCESS_CHANGED', id, {
          oldRole: user.role,
          role: nextRole,
          wasActive: user.isActive,
          isActive: nextActive,
        });
        return safeUser(updated);
      });
    },
  };
}
