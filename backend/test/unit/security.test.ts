import { describe, expect, it } from 'vitest';
import {
  decrypt,
  digest,
  encrypt,
  hashPassword,
  token,
  verifyPassword,
} from '../../src/lib/security.js';
import { envSchema } from '../../src/config/env.schema.js';

describe('security primitives', () => {
  it('hashes passwords with unique salts and rejects incorrect passwords', async () => {
    const password = 'Test-only secret passphrase';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
    expect(await hashPassword(password)).not.toBe(hash);
  });
  it('authenticates encrypted email payloads and rejects tampering', () => {
    const key = 'a'.repeat(64);
    const message = { text: 'private verification link' };
    const payload = encrypt(message, key);
    expect(payload).not.toContain('private');
    expect(decrypt(payload, key)).toEqual(message);
    const bytes = Buffer.from(payload, 'base64');
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    expect(() => decrypt(bytes.toString('base64'), key)).toThrow();
  });
  it('produces unpredictable tokens and separate stored hashes', () => {
    const secret = token();
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect(token()).not.toBe(secret);
    expect(digest(secret)).not.toBe(secret);
  });
  it('rejects missing secrets, malformed origins, and production mailbox use', () => {
    const base = {
      DATABASE_URL: 'postgresql://app:secret@localhost/lms',
      FRONTEND_URL: 'http://localhost:3000',
      FRONTEND_ORIGINS: 'http://localhost:3000',
      MAIL_ENCRYPTION_KEY: 'a'.repeat(64),
    };
    expect(envSchema.safeParse(base).success).toBe(true);
    expect(envSchema.safeParse({ ...base, MAIL_ENCRYPTION_KEY: 'placeholder' }).success).toBe(
      false,
    );
    expect(
      envSchema.safeParse({ ...base, FRONTEND_ORIGINS: 'http://localhost:3000/path' }).success,
    ).toBe(false);
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'production' }).success).toBe(false);
  });
});
