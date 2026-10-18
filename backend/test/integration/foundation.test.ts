import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { envSchema } from '../../src/config/env.schema.js';
import { createDatabase } from '../../src/infrastructure/database/client.js';
import { hashPassword, digest } from '../../src/lib/security.js';
import { createEmailDispatcher } from '../../src/infrastructure/email/email.service.js';
import type { EmailMessage } from '../../src/infrastructure/email/mailbox.transport.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('Integration tests require an isolated TEST_DATABASE_URL ending in _test.');
const db = createDatabase(url);
const config = envSchema.parse({
  ...process.env,
  DATABASE_URL: url,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
});
const origin = config.FRONTEND_ORIGINS[0]!;
const password = 'Synthetic integration passphrase';
const adminId = randomUUID(),
  studentId = randomUUID(),
  lecturerId = randomUUID(),
  outsiderId = randomUUID();
let app: Express;
let passwordHash: string;
let messages: EmailMessage[];
const send = () =>
  createEmailDispatcher(
    db,
    {
      async send(_id, message) {
        messages.push(message);
      },
    },
    config.MAIL_ENCRYPTION_KEY,
  )();

async function login(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return cookies[0]!.split(';')[0]!;
}
async function course(cookie: string) {
  const res = await request(app)
    .post('/api/v1/courses')
    .set('Cookie', cookie)
    .set('Origin', origin)
    .send({ title: 'Full Stack Engineering' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}
async function write(path: string, cookie: string, body: object = {}) {
  return request(app).post(`/api/v1${path}`).set('Cookie', cookie).set('Origin', origin).send(body);
}
async function extractToken(email: string) {
  await send();
  const message = messages.findLast((m) => m.to === email);
  expect(message).toBeDefined();
  const secret = message!.text.match(/#token=([a-f0-9]{64})/)?.[1];
  expect(secret).toBeDefined();
  return secret!;
}

beforeAll(async () => {
  passwordHash = await hashPassword(password);
});
beforeEach(async () => {
  // Explicit child-first cleanup affects only the guarded isolated test database.
  await db.emailJob.deleteMany();
  await db.auditLog.deleteMany();
  await db.enrolment.deleteMany();
  await db.courseLecturer.deleteMany();
  await db.course.deleteMany();
  await db.authToken.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.user.createMany({
    data: [
      {
        id: adminId,
        email: 'admin@example.test',
        name: 'Admin',
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        passwordHash,
      },
      {
        id: studentId,
        email: 'student@example.test',
        name: 'Student',
        role: 'STUDENT',
        emailVerifiedAt: new Date(),
        passwordHash,
      },
      {
        id: lecturerId,
        email: 'lecturer@example.test',
        name: 'Lecturer',
        role: 'LECTURER',
        emailVerifiedAt: new Date(),
        lecturerApprovedAt: new Date(),
        passwordHash,
      },
      {
        id: outsiderId,
        email: 'outsider@example.test',
        name: 'Outsider',
        role: 'STUDENT',
        emailVerifiedAt: new Date(),
        passwordHash,
      },
    ],
  });
  app = createApp(db, config);
  messages = [];
});
afterAll(async () => {
  await db.$disconnect();
});

describe('FR01 account access', () => {
  it('requires email verification, consumes the link once, and never returns secrets', async () => {
    const input = { email: 'NEW@example.test', name: 'New Student', password };
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send(input);
    expect(registration.status).toBe(202);
    expect(JSON.stringify(registration.body)).not.toContain(password);
    const before = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: input.email, password });
    expect(before.status).toBe(403);
    const secret = await extractToken('new@example.test');
    const stored = await db.authToken.findFirstOrThrow({ where: { tokenHash: digest(secret) } });
    expect(stored.tokenHash).not.toBe(secret);
    const verification = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Origin', origin)
      .send({ token: secret });
    expect(verification.status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/verify-email')
          .set('Origin', origin)
          .send({ token: secret })
      ).status,
    ).toBe(400);
    const cookie = await login(input.email);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).body.data.passwordHash,
    ).toBeUndefined();
  });
  it('rejects administrator self-registration and unknown input fields', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({ email: 'fake@example.test', name: 'Fake Admin', password, role: 'ADMIN' });
    expect(response.status).toBe(400);
    const profile = await request(app)
      .patch('/api/v1/users/me')
      .set('Origin', origin)
      .set('Cookie', await login('student@example.test'))
      .send({ name: 'Student', role: 'ADMIN' });
    expect(profile.status).toBe(400);
  });
  it('returns generic duplicate registration and forgotten-password responses', async () => {
    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({ email: 'student@example.test', name: 'Duplicate', password });
    expect(duplicate.status).toBe(202);
    expect(await db.user.count({ where: { email: 'student@example.test' } })).toBe(1);
    const existing = await write('/auth/forgot-password', '', { email: 'student@example.test' });
    const absent = await write('/auth/forgot-password', '', { email: 'missing@example.test' });
    expect(existing.status).toBe(absent.status);
    expect(existing.body.data).toEqual(absent.body.data);
  });
  it('revokes all sessions after password reset and rejects expired or reused links', async () => {
    const cookie = await login('student@example.test');
    await write('/auth/forgot-password', '', { email: 'student@example.test' });
    const secret = await extractToken('student@example.test');
    const body = { token: secret, password: 'A different synthetic passphrase' };
    expect((await write('/auth/reset-password', '', body)).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await write('/auth/reset-password', '', body)).status).toBe(400);
    await write('/auth/forgot-password', '', { email: 'student@example.test' });
    const expired = await extractToken('student@example.test');
    await db.authToken.updateMany({
      where: { tokenHash: digest(expired) },
      data: { expiresAt: new Date(0) },
    });
    expect((await write('/auth/reset-password', '', { ...body, token: expired })).status).toBe(400);
    const oldPassword = await write('/auth/login', '', { email: 'student@example.test', password });
    expect(oldPassword.status).toBe(401);
  });
  it('logs out and rejects expired sessions', async () => {
    const cookie = await login('student@example.test');
    expect((await write('/auth/logout', cookie)).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    const next = await login('student@example.test');
    await db.session.updateMany({ where: { userId: studentId }, data: { expiresAt: new Date(0) } });
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', next)).status).toBe(401);
  });
  it('rejects writes without an allowed origin and limits authentication attempts', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'student@example.test', password })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', 'https://evil.example')
          .send({ email: 'student@example.test', password })
      ).status,
    ).toBe(403);
    for (let i = 0; i < 20; i++) await write('/auth/login', '', {});
    expect((await write('/auth/login', '', {})).status).toBe(429);
  });
});

describe('FR02 permissions and enrolment', () => {
  it('blocks pending lecturers until an administrator approves them', async () => {
    await db.user.update({ where: { id: lecturerId }, data: { lecturerApprovedAt: null } });
    expect(
      (await write('/auth/login', '', { email: 'lecturer@example.test', password })).status,
    ).toBe(403);
    const admin = await login('admin@example.test');
    expect((await write(`/admin/users/${lecturerId}/approve-lecturer`, admin)).status).toBe(200);
    await login('lecturer@example.test');
    expect(await db.auditLog.count({ where: { action: 'LECTURER_APPROVED' } })).toBe(1);
  });
  it('restricts administration and revokes access on account deactivation', async () => {
    const student = await login('student@example.test');
    expect((await request(app).get('/api/v1/admin/users').set('Cookie', student)).status).toBe(403);
    const admin = await login('admin@example.test');
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${studentId}`)
          .set('Cookie', admin)
          .set('Origin', origin)
          .send({ isActive: false })
      ).status,
    ).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', student)).status).toBe(401);
    expect(await db.session.count({ where: { userId: studentId } })).toBe(0);
  });
  it('prevents removal of the last active administrator', async () => {
    const admin = await login('admin@example.test');
    const response = await request(app)
      .patch(`/api/v1/admin/users/${adminId}`)
      .set('Cookie', admin)
      .set('Origin', origin)
      .send({ role: 'STUDENT' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LAST_ADMIN');
  });
  it('hides drafts, enforces membership, and removes course access immediately', async () => {
    const admin = await login('admin@example.test');
    const student = await login('student@example.test');
    const outsider = await login('outsider@example.test');
    const id = await course(admin);
    expect((await write(`/courses/${id}/enrolments`, admin, { studentId })).status).toBe(200);
    expect((await write(`/courses/${id}/enrolments`, admin, { studentId })).status).toBe(200);
    expect(await db.enrolment.count({ where: { courseId: id, studentId } })).toBe(1);
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', student)).status).toBe(
      404,
    );
    await write(`/courses/${id}/publish`, admin);
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', student)).status).toBe(
      200,
    );
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', outsider)).status).toBe(
      404,
    );
    expect(
      (await request(app).get('/api/v1/courses').set('Cookie', outsider)).body.data.items,
    ).toEqual([]);
    expect(
      (
        await request(app)
          .delete(`/api/v1/courses/${id}/enrolments/${studentId}`)
          .set('Cookie', admin)
          .set('Origin', origin)
      ).status,
    ).toBe(200);
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', student)).status).toBe(
      404,
    );
  });
  it('requires approved assigned lecturers and keeps archived courses read-only', async () => {
    const admin = await login('admin@example.test');
    const lecturer = await login('lecturer@example.test');
    const student = await login('student@example.test');
    const id = await course(admin);
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', lecturer)).status).toBe(
      404,
    );
    expect((await write(`/courses/${id}/lecturers`, admin, { lecturerId })).status).toBe(200);
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', lecturer)).status).toBe(
      200,
    );
    expect((await write('/courses', lecturer, { title: 'Forbidden Course' })).status).toBe(403);
    await write(`/courses/${id}/enrolments`, admin, { studentId });
    await write(`/courses/${id}/publish`, admin);
    await write(`/courses/${id}/archive`, admin);
    expect((await request(app).get(`/api/v1/courses/${id}`).set('Cookie', student)).status).toBe(
      200,
    );
    expect(
      (await write(`/courses/${id}/enrolments`, admin, { studentId: outsiderId })).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .patch(`/api/v1/courses/${id}`)
          .set('Cookie', admin)
          .set('Origin', origin)
          .send({ title: 'New title' })
      ).status,
    ).toBe(409);
  });
  it('handles concurrent duplicate enrolments without duplicate records', async () => {
    const admin = await login('admin@example.test');
    const id = await course(admin);
    const responses = await Promise.all([
      write(`/courses/${id}/enrolments`, admin, { studentId }),
      write(`/courses/${id}/enrolments`, admin, { studentId }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.enrolment.count({ where: { courseId: id } })).toBe(1);
  });
  it('preserves omitted course fields and rejects empty edits', async () => {
    const admin = await login('admin@example.test');
    const created = await write('/courses', admin, {
      title: 'Original course',
      description: 'Keep this description',
    });
    const id = created.body.data.id;
    const edit = await request(app)
      .patch(`/api/v1/courses/${id}`)
      .set('Cookie', admin)
      .set('Origin', origin)
      .send({ title: 'Renamed course' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.description).toBe('Keep this description');
    expect(
      (
        await request(app)
          .patch(`/api/v1/courses/${id}`)
          .set('Cookie', admin)
          .set('Origin', origin)
          .send({})
      ).status,
    ).toBe(400);
  });
  it('revokes sessions and clears incompatible memberships when a role changes', async () => {
    const admin = await login('admin@example.test');
    const student = await login('student@example.test');
    const id = await course(admin);
    await write(`/courses/${id}/enrolments`, admin, { studentId });
    const change = await request(app)
      .patch(`/api/v1/admin/users/${studentId}`)
      .set('Cookie', admin)
      .set('Origin', origin)
      .send({ role: 'LECTURER' });
    expect(change.status).toBe(200);
    expect(change.body.data.lecturerApprovedAt).toBeNull();
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', student)).status).toBe(401);
    expect(await db.enrolment.count({ where: { studentId } })).toBe(0);
    expect(
      (await write('/auth/login', '', { email: 'student@example.test', password })).status,
    ).toBe(403);
  });
});

describe('infrastructure', () => {
  it('serves liveness, readiness, request IDs, and safe validation errors', async () => {
    const health = await request(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.meta.requestId).toBe(health.headers['x-request-id']);
    expect(health.headers['x-powered-by']).toBeUndefined();
    expect((await request(app).get('/api/v1/ready')).status).toBe(200);
    expect((await request(app).get('/api/v1/unknown')).status).toBe(404);
    const invalid = await request(app)
      .get('/api/v1/courses/bad-id')
      .set('Cookie', await login('student@example.test'));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('retains failed email jobs for retry and clears sensitive payloads after success', async () => {
    await write('/auth/forgot-password', '', { email: 'student@example.test' });
    const broken = createEmailDispatcher(
      db,
      {
        async send() {
          throw new Error('secret should not be saved');
        },
      },
      config.MAIL_ENCRYPTION_KEY,
    );
    await broken();
    const failed = await db.emailJob.findFirstOrThrow();
    expect(failed.lastError).toBe('DELIVERY_FAILED');
    expect(failed.deliveredAt).toBeNull();
    expect(failed.payload).not.toContain('token=');
    await db.emailJob.update({ where: { id: failed.id }, data: { availableAt: new Date(0) } });
    await send();
    await send();
    expect(messages).toHaveLength(1);
    const sent = await db.emailJob.findUniqueOrThrow({ where: { id: failed.id } });
    expect(sent.deliveredAt).not.toBeNull();
    expect(sent.payload).toBe('');
  });
  it('uses a runtime database role without superuser or schema-creation privileges', async () => {
    const roles = await db.$queryRaw<
      Array<{ rolsuper: boolean; rolbypassrls: boolean }>
    >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(roles[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const privileges = await db.$queryRaw<
      Array<{ can_create: boolean }>
    >`SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create`;
    expect(privileges[0]?.can_create).toBe(false);
  });
});
