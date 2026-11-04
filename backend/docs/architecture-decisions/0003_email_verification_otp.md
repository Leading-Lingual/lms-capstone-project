# Email verification by emailed OTP

Date: 2026-11-04. Status: accepted by product owner. Requirement: FR01.

Replace verification links with six-digit codes delivered through the existing Resend email queue. The frontend retains the registration email and submits `{ email, otp }` to `/api/v1/auth/verify-email`; no frontend verification URL is required. Keep password recovery links and the local mailbox transport for development.

Generate codes with cryptographic randomness, preserve leading zeroes, expire them after 10 minutes, and allow five incorrect attempts. Store a keyed digest bound to the account and challenge, not the plaintext code. Commit failed attempts even when returning an error. Serializable transactions prevent concurrent redemption and attempt-budget bypass. Issue at most one code per account every 60 seconds; newly issued codes invalidate their predecessors. Existing per-IP authentication limits and origin protections remain active.

The additive migration introduces a failed-attempt counter and invalidates outstanding verification links. Users with unverified accounts request a new code. The existing Resend configuration needs no additional variables. This intentionally changes the verification request contract from `{ token }` to `{ email, otp }`; coordinate the frontend update with rollout. The generic resend response does not confirm whether an account exists or whether a message was sent.
