import type { EmailMessage } from './mailbox.transport.js';

import { escapeHtml } from './html.js';

function layout(title: string, preview: string, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${title} | Thriving in Tech</title>
  <style>
    @media only screen and (max-width: 600px) {
      .outer { padding: 24px 12px !important; }
      .content { padding: 28px 24px !important; }
      .heading { font-size: 28px !important; line-height: 34px !important; }
      .code { font-size: 34px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f2f6f5;color:#19312e;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f6f5;">
    <tr><td class="outer" align="center" style="padding:48px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr><td style="padding:0 8px 28px;">
          <p style="margin:0;color:#115c4f;font-size:22px;font-weight:700;line-height:28px;">Thriving in Tech</p>
          <p style="margin:4px 0 0;color:#526863;font-size:13px;line-height:20px;">Learning Management System</p>
        </td></tr>
        <tr><td class="content" bgcolor="#ffffff" style="padding:40px;border:1px solid #dce5e1;border-radius:16px;background-color:#ffffff;">
          <h1 class="heading" style="margin:0 0 24px;color:#19312e;font-size:30px;font-weight:700;line-height:38px;letter-spacing:-0.5px;">${title}</h1>
          ${content}
          <p style="margin:28px 0 0;padding-top:24px;border-top:1px solid #e3eae6;color:#526863;font-size:14px;line-height:22px;">If you didn’t request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="padding:24px 8px 0;color:#526863;font-size:12px;line-height:20px;">
          <p style="margin:0;">Thriving in Tech LMS · Account security</p>
          <p style="margin:4px 0 0;">Keep your codes and account details private.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

export function verificationEmail(input: { to: string; name: string; otp: string }): EmailMessage {
  if (!/^\d{6}$/.test(input.otp)) throw new Error('Expected a six-digit verification code.');
  return {
    to: input.to,
    subject: 'Verify your Thriving in Tech account',
    text: `Hi ${input.name},\n\nYour Thriving in Tech verification code is: ${input.otp}\n\nEnter this code in the app to verify your email. It expires in 10 minutes and can only be used once. Do not share this code with anyone.\n\nIf you did not request this, ignore this message.\n\nThriving in Tech LMS`,
    html: layout(
      'Verify your email',
      'Use your code to finish setting up your account. Expires in 10 minutes.',
      `<p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hi ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 28px;color:#405951;font-size:16px;line-height:26px;">Welcome to Thriving in Tech. Enter the code below in the app to verify your email and continue setting up your account.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" bgcolor="#eef5f1" style="padding:24px 12px;border-radius:12px;background-color:#eef5f1;">
              <p class="code" style="margin:0;color:#115c4f;font-family:Arial,Helvetica,sans-serif;font-size:40px;font-weight:700;line-height:52px;letter-spacing:8px;">${input.otp}</p>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;color:#405951;font-size:14px;line-height:24px;"><strong style="color:#19312e;">Valid for 10 minutes.</strong> This code can only be used once.</p>
          <p style="margin:8px 0 0;color:#405951;font-size:14px;line-height:24px;">Do not share this code with anyone.</p>`,
    ),
  };
}

export function passwordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): EmailMessage {
  const url = new URL(input.resetUrl);
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('Expected an HTTP password reset URL.');
  const link = escapeHtml(url.toString());
  return {
    to: input.to,
    subject: 'Reset your Thriving in Tech password',
    text: `Hi ${input.name},\n\nWe received a request to reset your Thriving in Tech password. Open ${url.toString()} to choose a new password.\n\nThis link expires in 1 hour and can only be used once. Do not share this link with anyone.\n\nIf you did not request this, ignore this message. Your password will stay the same.\n\nThriving in Tech LMS`,
    html: layout(
      'Reset your password',
      'Choose a new password for your account. This link expires in 1 hour.',
      `<p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hi ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 28px;color:#405951;font-size:16px;line-height:26px;">We received a request to reset your Thriving in Tech password. Use the button below to choose a new one.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#115c4f" style="border-radius:8px;background-color:#115c4f;mso-padding-alt:16px 24px;">
              <a href="${link}" style="display:inline-block;padding:16px 24px;border:1px solid #115c4f;border-radius:8px;color:#ffffff;font-size:16px;font-weight:700;line-height:22px;text-decoration:none;">Reset password</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;color:#405951;font-size:14px;line-height:24px;"><strong style="color:#19312e;">Valid for 1 hour.</strong> This link can only be used once. Your password will stay the same until you choose a new one.</p>
          <p style="margin:24px 0 8px;color:#526863;font-size:13px;line-height:22px;">If the button doesn’t work, copy and paste this link into your browser:</p>
          <p style="margin:0;font-size:13px;line-height:22px;overflow-wrap:anywhere;word-break:break-all;"><a href="${link}" style="color:#115c4f;text-decoration:underline;word-break:break-all;">${link}</a></p>`,
    ),
  };
}
