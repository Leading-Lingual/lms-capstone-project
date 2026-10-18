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
  it('rejects mailbox delivery, missing provider secrets, and HTTP origins in production', () => {
    expect(envSchema.safeParse({ ...base, EMAIL_DRIVER: 'mailbox' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, RESEND_API_KEY: '' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, EMAIL_FROM: '' }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...base, FRONTEND_ORIGINS: 'http://localhost:3000' }).success,
    ).toBe(false);
    expect(envSchema.safeParse({ ...base, FRONTEND_URL: 'http://localhost:3000' }).success).toBe(
      false,
    );
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
      text: 'Private verification link',
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
