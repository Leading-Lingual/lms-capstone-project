import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import type { Database } from './infrastructure/database/client.js';
import type { Config } from './config/env.schema.js';
import { AppError } from './lib/errors.js';
import { ok, pageSchema } from './lib/http.js';
import { authenticate } from './middleware/authenticate.middleware.js';
import { authorize } from './middleware/authorize.middleware.js';
import { errorHandler } from './middleware/error-handler.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { adminUsersRoutes, usersRoutes } from './modules/users/users.routes.js';
import { coursesRoutes } from './modules/courses/courses.routes.js';

export function createApp(db: Database, config: Config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(
    pinoHttp({
      level: config.LOG_LEVEL,
      genReqId: (req) => (req as express.Request).requestId,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: String(req.url).split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || config.FRONTEND_ORIGINS.includes(origin)) callback(null, true);
        else callback(new AppError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed.'));
      },
    }),
  );
  // Browser cookie writes require an explicit allowed Origin, including login.
  // Non-browser clients must supply the same Origin header; this is documented.
  app.use((req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !config.FRONTEND_ORIGINS.includes(req.get('Origin') ?? '')
    ) {
      throw new AppError(
        403,
        'ORIGIN_FORBIDDEN',
        'An allowed Origin header is required for writes.',
      );
    }
    next();
  });
  app.get('/api/v1/health', (req, res) => ok(req, res, { status: 'ok' }));
  app.get('/api/v1/ready', async (req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      ok(req, res, { status: 'ready' });
    } catch {
      throw new AppError(503, 'NOT_READY', 'Database is unavailable.');
    }
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.' },
          meta: { requestId: req.requestId },
        }),
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes(db, config));
  app.use('/api/v1/users', authenticate(db), usersRoutes(db));
  app.use('/api/v1/admin/users', authenticate(db), adminUsersRoutes(db));
  app.use('/api/v1/courses', authenticate(db), coursesRoutes(db));
  app.get('/api/v1/admin/audit-logs', authenticate(db), authorize('ADMIN'), async (req, res) => {
    const { page, limit } = pageSchema.parse(req.query);
    ok(req, res, {
      items: await db.auditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      page,
      limit,
    });
  });
  app.use(() => {
    throw new AppError(404, 'NOT_FOUND', 'Endpoint not found.');
  });
  app.use(errorHandler);
  return app;
}
