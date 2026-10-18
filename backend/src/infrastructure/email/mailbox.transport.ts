import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export interface EmailTransport {
  send(id: string, message: EmailMessage): Promise<void>;
}

export function mailboxTransport(directory: string): EmailTransport {
  const destination = resolve(directory);
  return {
    async send(id, message) {
      await mkdir(destination, { recursive: true, mode: 0o700 });
      // Stable job filenames make retries idempotent in the development mailbox.
      await writeFile(join(destination, `${id}.json`), JSON.stringify(message, null, 2), {
        mode: 0o600,
      });
    },
  };
}
