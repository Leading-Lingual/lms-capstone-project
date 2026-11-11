import { z } from 'zod';
import type { EmailTransport } from './mailbox.transport.js';
import { EmailDeliveryError } from './delivery-error.js';
import { parseEmailSender } from './sender.js';
import { escapeHtml } from './html.js';

export function brevoTransport(
  apiKey: string,
  from: string,
  timeoutMs: number,
  sendRequest: typeof fetch = fetch,
): EmailTransport {
  const sender = parseEmailSender(from);
  if (!sender) throw new Error('Invalid email sender configuration.');
  return {
    async send(id, message) {
      let response: Response;
      try {
        response = await sendRequest('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender,
            to: [{ email: message.to }],
            subject: message.subject,
            textContent: message.text,
            htmlContent:
              message.html ||
              `<html><body><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;">${escapeHtml(message.text)}</pre></body></html>`,
            headers: { idempotencyKey: id },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new EmailDeliveryError(true);
      }
      if (!response.ok) {
        // Accept only Brevo's acknowledgement of an already-processed idempotency key.
        const error = z
          .object({ code: z.string(), message: z.string() })
          .safeParse(await response.json().catch(() => undefined));
        if (
          response.status === 400 &&
          error.success &&
          error.data.code === 'duplicate_parameter' &&
          /idempotency key has already been processed/i.test(error.data.message)
        )
          return;
        throw new EmailDeliveryError(
          response.status === 408 || response.status === 429 || response.status >= 500,
        );
      }
      try {
        z.object({ messageId: z.string().min(1) }).parse(await response.json());
      } catch {
        throw new EmailDeliveryError(true);
      }
    },
  };
}
