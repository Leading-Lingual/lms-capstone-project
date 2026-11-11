import { z } from 'zod';
import type { EmailTransport } from './mailbox.transport.js';

import { EmailDeliveryError } from './delivery-error.js';
export { EmailDeliveryError } from './delivery-error.js';
export function resendTransport(
  apiKey: string,
  sender: string,
  sendRequest: typeof fetch = fetch,
): EmailTransport {
  return {
    async send(id, message) {
      let response: Response;
      try {
        response = await sendRequest('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `lms-email/${id}`,
          },
          body: JSON.stringify({
            from: sender,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new EmailDeliveryError(true);
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new EmailDeliveryError(
          response.status === 429 || response.status === 408 || response.status >= 500,
        );
      }
      try {
        z.object({ id: z.string().min(1) }).parse(await response.json());
      } catch {
        throw new EmailDeliveryError(true);
      }
    },
  };
}
