import { z } from 'zod';
import type { Database } from '../database/client.js';
import { decrypt } from '../../lib/security.js';
import type { EmailTransport } from './mailbox.transport.js';
import { EmailDeliveryError } from './resend.transport.js';

const messageSchema = z.object({ to: z.email(), subject: z.string(), text: z.string() });
export function createEmailDispatcher(db: Database, transport: EmailTransport, key: string) {
  return async function dispatch() {
    const now = new Date();
    const jobs = await db.emailJob.findMany({
      where: {
        deliveredAt: null,
        availableAt: { lte: now },
        attempts: { lt: 5 },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const job of jobs) {
      const claim = await db.emailJob.updateMany({
        where: {
          id: job.id,
          deliveredAt: null,
          attempts: { lt: 5 },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        data: { lockedUntil: new Date(Date.now() + 60000), attempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      try {
        await transport.send(job.id, messageSchema.parse(decrypt(job.payload, key)));
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            deliveredAt: new Date(),
            lockedUntil: null,
            payload: '',
            lastError: null,
          },
        });
      } catch (error) {
        // Never retain provider errors containing addresses, payloads, or secret links.
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            lockedUntil: null,
            lastError:
              error instanceof EmailDeliveryError && !error.retryable
                ? 'DELIVERY_REJECTED'
                : 'DELIVERY_FAILED',
            ...(error instanceof EmailDeliveryError && !error.retryable ? { attempts: 5 } : {}),
            availableAt: new Date(Date.now() + 1000 * 2 ** (job.attempts + 1)),
          },
        });
      }
    }
  };
}
