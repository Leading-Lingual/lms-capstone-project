import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { envSchema } from '../../src/config/env.schema.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

const origins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
  'https://frontend.example.com',
];
const config = envSchema.parse({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/origins_test',
  FRONTEND_URL: origins[0],
  FRONTEND_ORIGINS: origins.join(','),
  EMAIL_DRIVER: 'resend',
  RESEND_API_KEY: 'synthetic-key',
  EMAIL_FROM: 'noreply@example.com',
  MAIL_ENCRYPTION_KEY: 'a'.repeat(64),
  LOG_LEVEL: 'silent',
});
const db = createDatabase(config.DATABASE_URL);
const app = createApp(db, config);
afterAll(async () => {
  await db.$disconnect();
});

describe('production frontend origin allowlist', () => {
  it('accepts preflight and writes from configured localhost and HTTPS frontends', async () => {
    for (const origin of origins) {
      const preflight = await request(app)
        .options('/api/v1/auth/verify-email')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');
      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(origin);
      expect(preflight.headers['access-control-allow-credentials']).toBe('true');
      // Invalid input reaches route validation without requiring any database connection.
      const response = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', origin)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
  it('continues to reject missing origins and origins outside the exact allowlist', async () => {
    for (const origin of [
      undefined,
      'http://localhost:3001',
      'http://localhost.evil.example:3000',
      'https://unlisted.example.com',
    ]) {
      const req = request(app).post('/api/v1/auth/verify-email');
      if (origin) req.set('Origin', origin);
      const response = await req.send({});
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ORIGIN_FORBIDDEN');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});
