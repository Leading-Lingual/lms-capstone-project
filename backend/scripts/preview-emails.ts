import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { passwordResetEmail, verificationEmail } from '../src/infrastructure/email/templates.js';

const directory = new URL('../../tmp/email-previews/', import.meta.url);
await mkdir(directory, { recursive: true });
const recipient = { to: 'student@example.test', name: 'Marvellous' };
const samples = {
  verification: verificationEmail({ ...recipient, otp: '012345' }),
  'password-reset': passwordResetEmail({
    ...recipient,
    resetUrl: `https://frontend.example.com/reset-password#token=${'a'.repeat(64)}`,
  }),
};
for (const [name, message] of Object.entries(samples)) {
  await writeFile(new URL(`${name}.html`, directory), message.html!);
  await writeFile(new URL(`${name}.txt`, directory), message.text);
}
await writeFile(
  new URL('index.html', directory),
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Email design previews</title></head><body style="margin:24px;background:#e5ebe8;font:16px Arial,sans-serif;color:#19312e;"><h1>Email design previews</h1><p>Synthetic examples only. These codes and links do not access any account.</p>${Object.keys(
    samples,
  )
    .map(
      (name) =>
        `<h2>${name}</h2><div style="display:flex;gap:24px;align-items:start;"><div><p>Desktop · 560 px</p><iframe title="${name} desktop" src="${name}.html" width="560" height="900" style="border:0;"></iframe></div><div><p>Mobile · 320 px</p><iframe title="${name} mobile" src="${name}.html" width="320" height="900" style="border:0;"></iframe></div></div>`,
    )
    .join('')}</body></html>`,
);
console.log(`Email previews: ${fileURLToPath(new URL('index.html', directory))}`);
