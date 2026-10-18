import type { Role } from '../generated/prisma/client.js';
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: { id: string; role: Role; sessionId: string };
    }
  }
}
export {};
