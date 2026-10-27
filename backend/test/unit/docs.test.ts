import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { envSchema } from '../../src/config/env.schema.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';

const config = envSchema.parse({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/docs_test',
  FRONTEND_URL: 'http://localhost:3000',
  FRONTEND_ORIGINS: 'http://localhost:3000',
  MAIL_ENCRYPTION_KEY: 'a'.repeat(64),
  LOG_LEVEL: 'silent',
});
const db = createDatabase(config.DATABASE_URL);
const app = createApp(db, config);
afterAll(async () => {
  await db.$disconnect();
});

describe('Swagger API documentation', () => {
  it('serves public documentation at the requested URL without a database connection', async () => {
    for (const path of ['/api/docs', '/api/docs/']) {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Thriving in Tech LMS API Documentation');
      expect(response.text).toContain('/api/docs/swagger-ui-bundle.js');
    }
  });
  it('serves the actual contract with the correct API base and session security', async () => {
    const response = await request(app).get('/api/docs/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.servers).toEqual([{ url: '/api/v1' }]);
    expect(response.body.paths['/auth/login'].post).toBeDefined();
    expect(response.body.paths['/courses'].get.security).toEqual([{ sessionCookie: [] }]);
    expect(response.body.components.securitySchemes.sessionCookie.name).toBe('lms_session');
  });
  it('serves local assets and prevents external validators and configuration overrides', async () => {
    expect((await request(app).get('/api/docs/swagger-ui.css')).headers['content-type']).toContain(
      'text/css',
    );
    const bundle = await request(app).get('/api/docs/swagger-ui-bundle.js');
    expect(bundle.status).toBe(200);
    expect(bundle.text).toContain('SwaggerUIBundle');
    const init = await request(app).get('/api/docs/swagger-initializer.js');
    expect(init.status).toBe(200);
    expect(init.text).toContain("url: '/api/docs/openapi.json'");
    expect(init.text).toContain('validatorUrl: null');
    expect(init.text).toContain('persistAuthorization: false');
    expect(init.text).toContain('withCredentials: true');
    expect(init.text).toContain('queryConfigEnabled: false');
  });
  it('allows only same-origin scripts and preserves protected API access and write-origin checks', async () => {
    const response = await request(app).get('/api/docs');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect((await request(app).get('/api/v1/courses')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', 'https://untrusted.example')
          .send({})
      ).status,
    ).toBe(403);
  });
  it('keeps unknown documentation and asset paths on the standard 404 handler', async () => {
    expect((await request(app).get('/api/docs/unknown')).status).toBe(404);
    expect((await request(app).get('/api/docs/package.json')).status).toBe(404);
  });
});
