import { describe, expect, it } from 'vitest';
import { passwordResetEmail, verificationEmail } from '../../src/infrastructure/email/templates.js';

const recipient = { to: 'student@example.test', name: 'Ada <script>alert("x")</script> & Co' };
describe('transactional email templates', () => {
  it('preserves leading-zero OTPs and includes instructions in HTML and plain text', () => {
    const message = verificationEmail({ ...recipient, otp: '012345' });
    expect(message.text).toContain('verification code is: 012345');
    expect(message.text).toContain('10 minutes');
    expect(message.html).toContain('>012345</p>');
    expect(message.html).toContain('Valid for 10 minutes.');
    expect(message.html).toContain('can only be used once');
    expect(message.html).toContain('Do not share this code');
    expect(message.html).toContain(
      'Ada &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co',
    );
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toMatch(/<img|<script|<link\s/i);
    expect(message.html).toContain('name="viewport"');
    expect(message.html).toContain('@media');
    expect(message.html).toContain('role="presentation"');
  });
  it('rejects malformed verification codes', () => {
    for (const otp of ['12345', '1234567', '<img>', '12 345']) {
      expect(() => verificationEmail({ ...recipient, otp })).toThrow();
    }
  });
  it('preserves reset fragments and safely escapes the button and copyable link', () => {
    const resetUrl = `https://frontend.example.com/reset-password?source=email&locale=en#token=${'a'.repeat(64)}`;
    const message = passwordResetEmail({ ...recipient, resetUrl });
    const escaped = resetUrl.replace('&', '&amp;');
    expect(message.text).toContain(resetUrl);
    expect(message.html?.split(`href="${escaped}"`)).toHaveLength(3);
    expect(message.html).toContain(`>${escaped}</a>`);
    expect(message.html).toContain('Reset password</a>');
    expect(message.html).toContain('Valid for 1 hour.');
    expect(message.text).toContain('expires in 1 hour');
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('Your password will stay the same');
    expect(message.html).toContain('safely ignore');
  });
  it('rejects executable and invalid password recovery URLs', () => {
    for (const resetUrl of ['javascript:alert(1)', 'data:text/html,hello', 'not a URL']) {
      expect(() => passwordResetEmail({ ...recipient, resetUrl })).toThrow();
    }
  });
});
