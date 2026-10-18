import { Router } from 'express';
import type { Database } from '../../infrastructure/database/client.js';
import { authorize } from '../../middleware/authorize.middleware.js';
import { idSchema, ok, pageSchema } from '../../lib/http.js';
import {
  createCourseSchema,
  lecturerSchema,
  studentSchema,
  updateCourseSchema,
} from './courses.schema.js';
import { createCoursesService } from './courses.service.js';

export function coursesRoutes(db: Database) {
  const router = Router();
  const service = createCoursesService(db);
  router.get('/', async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query);
    ok(req, res, {
      items: await service.list(req.actor!.id, req.actor!.role, page, limit),
      page,
      limit,
    });
  });
  router.get('/:id', async (req, res) => {
    ok(req, res, await service.get(idSchema.parse(req.params.id), req.actor!.id, req.actor!.role));
  });
  router.post('/', authorize('ADMIN'), async (req, res) => {
    ok(
      req,
      res,
      await service.create(createCourseSchema.parse(req.body), req.actor!.id, req.requestId),
      201,
    );
  });
  router.patch('/:id', authorize('ADMIN'), async (req, res) => {
    ok(
      req,
      res,
      await service.change(
        idSchema.parse(req.params.id),
        updateCourseSchema.parse(req.body),
        req.actor!.id,
        req.requestId,
      ),
    );
  });
  router.post('/:id/publish', authorize('ADMIN'), async (req, res) => {
    ok(
      req,
      res,
      await service.change(
        idSchema.parse(req.params.id),
        { status: 'PUBLISHED' },
        req.actor!.id,
        req.requestId,
      ),
    );
  });
  router.post('/:id/archive', authorize('ADMIN'), async (req, res) => {
    ok(
      req,
      res,
      await service.change(
        idSchema.parse(req.params.id),
        { archivedAt: new Date() },
        req.actor!.id,
        req.requestId,
      ),
    );
  });
  for (const [path, kind, schema, field] of [
    ['enrolments', 'STUDENT', studentSchema, 'studentId'],
    ['lecturers', 'LECTURER', lecturerSchema, 'lecturerId'],
  ] as const) {
    router.post(`/:id/${path}`, authorize('ADMIN'), async (req, res) => {
      const input = schema.parse(req.body) as { studentId?: string; lecturerId?: string };
      ok(
        req,
        res,
        await service.membership(
          idSchema.parse(req.params.id),
          input[field]!,
          kind,
          false,
          req.actor!.id,
          req.requestId,
        ),
      );
    });
    router.delete(`/:id/${path}/:memberId`, authorize('ADMIN'), async (req, res) => {
      ok(
        req,
        res,
        await service.membership(
          idSchema.parse(req.params.id),
          idSchema.parse(req.params.memberId),
          kind,
          true,
          req.actor!.id,
          req.requestId,
        ),
      );
    });
  }
  return router;
}
