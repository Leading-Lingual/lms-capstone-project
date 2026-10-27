import { Router } from 'express';
import { z } from 'zod';
import type { Database } from '../../infrastructure/database/client.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { idSchema, ok, pageSchema } from '../../lib/http.js';
import { safeUser } from '../auth/auth.service.js';
import { createUsersService, userStateSchema } from './users.service.js';

export function usersRoutes(db: Database) {
  const router = Router();
  router.patch('/me', async (req, res) => {
    const input = z.strictObject({ name: z.string().trim().min(2).max(100) }).parse(req.body);
    ok(req, res, safeUser(await db.user.update({ where: { id: req.actor!.id }, data: input })));
  });
  return router;
}
export function adminUsersRoutes(db: Database) {
  const router = Router();
  const service = createUsersService(db);
  router.use(authorize('ADMIN'));
  router.get('/', async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query);
    const users = await db.user.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
    ok(req, res, { items: users.map(safeUser), page, limit });
  });
  router.post('/:id/approve-lecturer', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    ok(req, res, await service.approveLecturer(id, req.actor!.id, req.requestId));
  });
  router.patch('/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    ok(
      req,
      res,
      await service.updateState(id, userStateSchema.parse(req.body), req.actor!.id, req.requestId),
    );
  });
  return router;
}
