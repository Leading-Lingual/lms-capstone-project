import type { Request, Response } from 'express';
import { z } from 'zod';
export const idSchema = z.uuid();
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function ok(req: Request, res: Response, data: unknown, status = 200) {
  return res.status(status).json({ data, meta: { requestId: req.requestId } });
}
