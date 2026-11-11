import type { Config } from '../../config/env.schema.js';
import { mailboxTransport } from './mailbox.transport.js';
import { resendTransport } from './resend.transport.js';
import { brevoTransport } from './brevo.transport.js';
export function createEmailTransport(config: Config) {
  if (config.EMAIL_PROVIDER === 'brevo')
    return brevoTransport(config.BREVO_API_KEY!, config.EMAIL_FROM!, config.BREVO_API_TIMEOUT_MS);
  return config.EMAIL_PROVIDER === 'resend'
    ? resendTransport(config.RESEND_API_KEY!, config.EMAIL_FROM!)
    : mailboxTransport(config.MAILBOX_DIR);
}
