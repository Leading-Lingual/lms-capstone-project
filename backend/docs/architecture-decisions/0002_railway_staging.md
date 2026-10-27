# Railway staging preparation

Date: 18 October 2026

Railway is the selected deployment target for the first staging environment. The backend remains a single Express.js service with PostgreSQL. The repository root is the build context because package-lock.json and the workspace manifest live there.

The Docker build installs the locked dependencies, generates Prisma Client, compiles TypeScript, and prunes development tools. The runtime image runs as the non-root node user. Prisma CLI is an explicit runtime dependency because Railway runs migrations from the same image in a separate pre-deploy container. The API uses DATABASE_URL; the migration command uses DIRECT_URL. Railway supplies the same service variables to both phases, so the migration credential is present in the service environment. A separate migration service with isolated secrets is a later hardening option.

Production binds to 0.0.0.0 on Railway's PORT; development keeps localhost as its default. Railway promotes the deployment only after the database readiness endpoint succeeds. A failed pre-deploy migration blocks promotion. Keep one replica because request throttling is currently in memory.

The previous production-mode prohibition is replaced by conditional validation: production requires an external email transport and HTTPS frontend configuration. Resend is the initial supported provider. A verified sender and API key must be configured before real delivery. Existing encrypted PostgreSQL email jobs are reused; their IDs become stable provider idempotency keys. Network errors, timeouts, rate limits, and provider 5xx responses are retried. Permanent rejection ends automatic retry without persisting provider response bodies.

The provider's idempotency window is limited; delivery is not guaranteed exactly once after that window. Keep MAIL_ENCRYPTION_KEY stable across releases while encrypted jobs remain pending, and rotate it only through a planned migration. Local mailbox delivery remains available only outside production.

No real email is sent by automated tests. The container smoke environment has an internal Docker network, isolated PostgreSQL, synthetic credentials, and no application data. Verification and recovery still require future frontend pages, so this deployment is an API staging environment rather than a complete learner-facing release.

The repository's main branch begins with an empty bootstrap commit. All application and deployment files are introduced on a feature branch for pull-request review; no application code bypasses review into main. Staging provisioning and secrets remain separate from committing the prepared configuration.

References: [Railway Docker builds](https://docs.railway.com/builds/dockerfiles), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [healthchecks](https://docs.railway.com/deployments/healthchecks), [Resend send API](https://resend.com/docs/api-reference/emails/send-email), and [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
