import type { Prisma } from '../../generated/prisma/client.js';
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string | null,
  requestId: string,
  action: string,
  resourceId: string,
  metadata?: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({ data: { actorId, requestId, action, resourceId, metadata } });
}
