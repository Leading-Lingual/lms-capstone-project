import type { Database } from './client.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';

export async function transaction<T>(
  db: Database,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034')
        throw error;
    }
  }
  throw new AppError(409, 'CONCURRENT_CHANGE', 'A concurrent change occurred. Please retry.');
}
