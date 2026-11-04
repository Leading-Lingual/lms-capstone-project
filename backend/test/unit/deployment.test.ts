import { describe, expect, it, vi } from 'vitest';
import { envSchema } from '../../src/config/env.schema.js';
import {
  EmailDeliveryError,
  resendTransport,
} from '../../src/infrastructure/email/resend.transport.js';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:example@postgres.railway.internal/lms',
  FRONTEND_URL: 'https://app.example.com',
  FRONTEND_ORIGINS: 'https://app.example.com',
  MAIL_ENCRYPTION_KEY: 'a'.repeat(64),
  EMAIL_DRIVER: 'resend',
  RESEND_API_KEY: 'synthetic-test-api-key',
  EMAIL_FROM: 'noreply@example.com',
};
describe('deployment configuration', () => {
  it('accepts an HTTPS deployment with Resend and listens on all container interfaces', () => {
    const config = envSchema.parse(base);
    expect(config.HOST).toBe('0.0.0.0');
    expect(envSchema.parse({ ...base, NODE_ENV: 'development' }).HOST).toBe('127.0.0.1');
  });
  it('rejects mailbox delivery and missing provider secrets in production', () => {
    expect(envSchema.safeParse({ ...base, EMAIL_DRIVER: 'mailbox' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, RESEND_API_KEY: '' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, EMAIL_FROM: '' }).success).toBe(false);
  });
  it('allows the three requested localhost origins alongside a deployed HTTPS frontend', () => {
    const origins =
      'http://localhost:3000,http://localhost:5173,http://localhost:8081,https://app.example.com';
    for (const url of origins.split(',')) {
      const config = envSchema.parse({ ...base, FRONTEND_URL: url, FRONTEND_ORIGINS: origins });
      expect(config.FRONTEND_URL).toBe(url);
      expect(config.FRONTEND_ORIGINS).toEqual(origins.split(','));
    }
  });
  it('rejects HTTP remote hosts, localhost lookalikes, unapproved ports, and origin paths', () => {
    for (const value of [
      'http://app.example.com',
      'http://localhost.evil.example:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://localhost:3000/path',
      'http://localhost:3000/',
    ]) {
      expect(envSchema.safeParse({ ...base, FRONTEND_ORIGINS: value }).success, value).toBe(false);
    }
    expect(envSchema.safeParse({ ...base, FRONTEND_URL: 'http://app.example.com' }).success).toBe(
      false,
    );
  });
  it('reports malformed lists as validation errors without throwing, and requires one frontend URL', () => {
    for (const value of [
      '',
      'not-a-url',
      'https://app.example.com,invalid',
      'https://app.example.com,',
    ]) {
      expect(envSchema.safeParse({ ...base, FRONTEND_ORIGINS: value }).success).toBe(false);
    }
    const result = envSchema.safeParse({
      ...base,
      FRONTEND_URL: 'http://localhost:3000,http://localhost:5173',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path[0] === 'FRONTEND_URL')).toBe(true);
  });
});
describe('Resend delivery', () => {
  it('uses a stable job idempotency key and sends the expected private payload', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }),
      );
    const transport = resendTransport('test-key', 'noreply@example.com', send);
    const message = {
      to: 'student@example.test',
      subject: 'Verify account',
      text: 'Your Thriving in Tech verification code is: 012345',
      html: '<html><body><p>012345</p></body></html>',
    };
    await transport.send('job-id', message);
    await transport.send('job-id', message);
    expect(send).toHaveBeenCalledTimes(2);
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Idempotency-Key': 'lms-email/job-id',
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      from: 'noreply@example.com',
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    expect(send.mock.calls[1]?.[1]?.headers).toEqual(options?.headers);
  });
  it.each([408, 429, 500, 503])(
    'retries HTTP %s without exposing provider response data',
    async (status) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('recipient and secret response', { status }));
      const operation = resendTransport('test-key', 'noreply@example.com', send).send('id', {
        to: 'student@example.test',
        subject: 'Account',
        text: 'Private',
      });
      await expect(operation).rejects.toMatchObject({
        retryable: true,
        message: 'EMAIL_DELIVERY_FAILED',
      });
    },
  );
  it('does not retry a permanent rejection', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private provider error', { status: 422 }));
    await expect(
      resendTransport('test-key', 'noreply@example.com', send).send('id', {
        to: 'student@example.test',
        subject: 'Account',
        text: 'Private',
      }),
    ).rejects.toMatchObject({ retryable: false });
  });
  it('treats network failures as retryable without leaking secrets', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('private network failure'));
    const result = resendTransport('test-key', 'noreply@example.com', send).send('id', {
      to: 'student@example.test',
      subject: 'Account',
      text: 'Private',
    });
    await expect(result).rejects.toBeInstanceOf(EmailDeliveryError);
  });
});
