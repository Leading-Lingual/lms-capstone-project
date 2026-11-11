# Brevo for hosted account email

Date: 2026-11-11. Status: accepted by product owner. Requirements: FR01 and FR10 delivery infrastructure.

Use Brevo with the authorized Renova Africa account and active sender `Renova Africa <hello@renovaafrica.com>`. This supersedes Resend as the selected hosted provider in Decision 0002: the shared Resend test sender rejected signup recipients outside the account owner's address. Keep the LMS templates, encrypted PostgreSQL queue, email OTP rules, recovery links, and private development mailbox. Resend remains a supported alternative.

Select the provider using EMAIL_PROVIDER. Retain EMAIL_DRIVER as a legacy alias, with EMAIL_PROVIDER taking precedence. Brevo requires BREVO_API_KEY and EMAIL_FROM; BREVO_API_TIMEOUT_MS defaults to 10000 and permits 1000–30000 milliseconds. EMAIL_FROM accepts a bare email address or display name plus address. Keys belong only in ignored local environment files or Railway secrets, never source control or logs.

Send through the HTTPS transactional API with HTML and plain text, using the existing job UUID as the idempotency key. Treat only the explicit already-processed idempotency acknowledgement as a successful retry. Retry timeouts, network failures, HTTP 408/429 and 5xx; stop on permanent provider rejections. Provider bodies remain private. No dependency, migration, or frontend API change is required.

After rollout, existing unverified users must request a fresh code. Do not requeue expired rejected OTP messages. Confirm delivery through the deployed queue to an explicitly authorized recipient.

References: [transactional email API](https://developers.brevo.com/reference/send-transac-email), [idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).
