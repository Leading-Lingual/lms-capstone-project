import { describe, expect, it, vi } from 'vitest';
import { brevoTransport } from '../../src/infrastructure/email/brevo.transport.js';
import { envSchema } from '../../src/config/env.schema.js';
import { createEmailTransport } from '../../src/infrastructure/email/transport.js';
import { parseEmailSender } from '../../src/infrastructure/email/sender.js';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://unused:unused@127.0.0.1/test',
  FRONTEND_URL: 'https://frontend.example.com',
  FRONTEND_ORIGINS: 'https://frontend.example.com',
  MAIL_ENCRYPTION_KEY: 'a'.repeat(64),
  EMAIL_PROVIDER: 'brevo',
  EMAIL_FROM: 'Renova Africa <hello@renovaafrica.com>',
  BREVO_API_KEY: 'synthetic-brevo-key',
  BREVO_API_TIMEOUT_MS: '10000',
};
const jobId = 'c4d5a34e-2dab-4ba3-82a9-4b50cfd2478d';
const message = {
  to: 'student@example.test',
  subject: 'Verify email',
  text: 'Code: 012345',
  html: '<p>012345</p>',
};
const ok = () =>
  new Response(JSON.stringify({ messageId: '<synthetic-message@example.test>' }), { status: 201 });

describe('Brevo configuration', () => {
  it('accepts the requested variables and selects Brevo over the legacy Resend driver', () => {
    const config = envSchema.parse({ ...base, EMAIL_DRIVER: 'resend', RESEND_API_KEY: undefined });
    expect(config.EMAIL_PROVIDER).toBe('brevo');
    expect(config.EMAIL_DRIVER).toBe('brevo');
    expect(config.BREVO_API_TIMEOUT_MS).toBe(10000);
    expect(createEmailTransport(config).send).toBeTypeOf('function');
    expect(parseEmailSender(config.EMAIL_FROM!)).toEqual({
      name: 'Renova Africa',
      email: 'hello@renovaafrica.com',
    });
  });
  it('requires a key and sender, bounds timeout, and rejects header injection', () => {
    for (const change of [
      { BREVO_API_KEY: '' },
      { EMAIL_FROM: '' },
      { EMAIL_FROM: 'Bad\r\nBcc: victim@example.test <hello@renovaafrica.com>' },
      { EMAIL_FROM: 'invalid' },
      { BREVO_API_TIMEOUT_MS: '0' },
      { BREVO_API_TIMEOUT_MS: '30001' },
    ]) {
      expect(envSchema.safeParse({ ...base, ...change }).success).toBe(false);
    }
    expect(parseEmailSender('hello@renovaafrica.com')).toEqual({ email: 'hello@renovaafrica.com' });
  });
});

describe('Brevo delivery', () => {
  it('sends the display-name sender, HTML and text, UUID idempotency key, and timeout', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const transport = brevoTransport('synthetic-key', base.EMAIL_FROM, 10000, fetcher);
      await transport.send(jobId, message);
      await transport.send(jobId, message);
      const [url, options] = fetcher.mock.calls[0]!;
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(options?.headers).toMatchObject({ 'api-key': 'synthetic-key' });
      expect(timeout).toHaveBeenCalledWith(10000);
      expect(JSON.parse(String(options?.body))).toEqual({
        sender: { name: 'Renova Africa', email: 'hello@renovaafrica.com' },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
        headers: { idempotencyKey: jobId },
      });
      expect(fetcher.mock.calls[1]?.[1]?.body).toBe(options?.body);
    } finally {
      timeout.mockRestore();
    }
  });
  it('renders old text-only messages as escaped HTML while retaining plain text', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => ok());
    await brevoTransport('key', 'hello@renovaafrica.com', 10000, fetcher).send(jobId, {
      ...message,
      html: undefined,
      text: '<script> & private',
    });
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.htmlContent).toContain('&lt;script&gt; &amp; private');
    expect(body.textContent).toBe('<script> & private');
  });
  it.each([408, 429, 500, 503])(
    'retries transient HTTP %s without exposing provider errors',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private address and code', { status }));
      await expect(
        brevoTransport('key', base.EMAIL_FROM, 10000, fetcher).send(jobId, message),
      ).rejects.toMatchObject({ retryable: true, message: 'EMAIL_DELIVERY_FAILED' });
    },
  );
  it.each([400, 401, 403, 422])('does not retry permanent HTTP %s errors', async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'invalid_parameter', message: 'private provider details' }),
          { status },
        ),
      );
    await expect(
      brevoTransport('key', base.EMAIL_FROM, 10000, fetcher).send(jobId, message),
    ).rejects.toMatchObject({ retryable: false, message: 'EMAIL_DELIVERY_FAILED' });
  });
  it('recognizes only an already-processed idempotency acknowledgement', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'duplicate_parameter',
          message: 'Email for the idempotency key has already been processed',
        }),
        { status: 400 },
      ),
    );
    await expect(
      brevoTransport('key', base.EMAIL_FROM, 10000, fetcher).send(jobId, message),
    ).resolves.toBeUndefined();
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'duplicate sender' }), {
        status: 400,
      }),
    );
    await expect(
      brevoTransport('key', base.EMAIL_FROM, 10000, fetcher).send(jobId, message),
    ).rejects.toMatchObject({ retryable: false });
  });
  it('safely retries network failures, timeouts, and malformed success responses', async () => {
    for (const failure of [
      new Error('private network details'),
      new DOMException('private timeout', 'TimeoutError'),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
      await expect(
        brevoTransport('key', base.EMAIL_FROM, 10000, fetcher).send(jobId, message),
      ).rejects.toMatchObject({ retryable: true, message: 'EMAIL_DELIVERY_FAILED' });
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 201 }));
    await expect(
      brevoTransport('key', base.EMAIL_FROM, 10000, fetcher).send(jobId, message),
    ).rejects.toMatchObject({ retryable: true });
  });
});
