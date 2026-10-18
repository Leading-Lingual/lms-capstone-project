import type { Config } from '../../config/env.schema.js';
import { mailboxTransport } from './mailbox.transport.js';
import { resendTransport } from './resend.transport.js';
export function createEmailTransport(config: Config) {
  return config.EMAIL_DRIVER === 'resend'
    ? resendTransport(config.RESEND_API_KEY!, config.EMAIL_FROM!)
    : mailboxTransport(config.MAILBOX_DIR);
}
