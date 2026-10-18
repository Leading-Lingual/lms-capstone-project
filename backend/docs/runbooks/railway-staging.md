# Railway staging deployment

This runbook deploys the current API foundation, not the complete LMS. The frontend and learning workflows beyond course shells are still under implementation. The prepared configuration does not create cloud resources, incur hosting charges, or send email on its own.

## Repository and service setup

1. Review and merge the implementation pull request. Connect `Leading-Lingual/lms-capstone-project` to a Railway project with a `staging` environment.
2. Add a PostgreSQL service and an API service from the repository. Keep the API root directory at `/`, so Docker can access the root lockfile and backend workspace. Railway reads the root `Dockerfile` and `railway.json`.
3. Select the reviewed source branch and require successful GitHub checks before deployment. Disable automatic deployments until the initial secrets and permissions are configured. Keep one API replica.
4. Set the variables below in the API service. Do not upload local `.env` files or development database credentials.
5. Set a pre-deploy timeout appropriate to the migrations, starting with 300 seconds. The configured command is `npm run db:migrate`; the image working directory is `/app/backend`. A nonzero exit blocks promotion. Readiness is `/api/v1/ready`.
6. Deploy the reviewed revision, generate a Railway domain or configure a custom API domain, and run the smoke command below against the resulting HTTPS URL.

## Required environment variables

| Variable            | Staging value                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| NODE_ENV            | `production` even in the staging environment, to enable secure cookies and validation                                   |
| DATABASE_URL        | Railway-private PostgreSQL URL using a restricted runtime role with data access, not the database owner                 |
| DIRECT_URL          | Railway-private PostgreSQL URL using the migration owner role                                                           |
| FRONTEND_URL        | HTTPS URL reserved for the frontend verification and password recovery pages                                            |
| FRONTEND_ORIGINS    | Exact comma-separated HTTPS frontend origins without paths or trailing slashes                                          |
| EMAIL_DRIVER        | `resend`                                                                                                                |
| RESEND_API_KEY      | Secret key for the selected Resend project                                                                              |
| EMAIL_FROM          | Sender email belonging to a verified domain                                                                             |
| MAIL_ENCRYPTION_KEY | Stable random 32-byte key encoded as 64 hexadecimal characters                                                          |
| TRUST_PROXY_HOPS    | Use `1` only after confirming the request path has exactly one trusted edge proxy; otherwise review the actual topology |
| SESSION_TTL_HOURS   | At most `168`; defaults to seven days                                                                                   |
| LOG_LEVEL           | `info`                                                                                                                  |

Allow Railway to supply PORT. Production HOST defaults to 0.0.0.0; do not set it to localhost. FRONTEND_URL is needed for email links even though those pages are not yet implemented. Keep the frontend and API on the same site when the frontend is introduced because cookies use SameSite Lax. Unrelated Railway and frontend provider domains will need a reviewed cookie and CSRF strategy or custom domains.

Create the runtime database role through a controlled database administration session before deploying. Grant CONNECT to the intended database, USAGE on its application schema, and SELECT, INSERT, UPDATE, DELETE on application tables, plus sequence privileges where needed. Set default privileges for the migration owner so future tables remain accessible. Do not grant superuser, BYPASSRLS, or schema-creation permissions to the runtime role. Limit audit table writes to append operations where practical. Local Compose demonstrates the initial role separation; do not reuse its passwords or smoke-test passwords.

## Verification

Run from the repository root after replacing the example URL with the actual API domain:

```powershell
node scripts/smoke-api.mjs https://your-api-domain
```

Check `/api/v1/health`, database readiness, and denial of anonymous course access. Confirm the running process is non-root, the release revision matches the reviewed commit, the logs contain no secrets, and the service restarts without losing sessions or email jobs. Verify the Secure and HttpOnly cookie attributes over HTTPS. Use an explicitly authorised test recipient for real email verification; automated tests use mocks and send no messages.

Create the first administrator through a controlled one-off process using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The current bootstrap command uses the TypeScript runner, which is not included in the pruned image; run `npm run admin:create` from a trusted checkout with development dependencies, using a temporary secure connection to the staging database. Never add a public administrator creation endpoint or persist the bootstrap password in service variables.

Before opening access to a pilot cohort, complete database and object-storage recovery planning, retention and deletion policy, monitoring, frontend verification pages, and the remaining MVP workflows. Configure backups on the actual Railway database plan and perform a restore drill; this configuration does not provide a verified backup policy by itself.

## Local container verification

```powershell
docker compose -f compose.smoke.yaml up --build -d --wait api
docker compose -f compose.smoke.yaml run --rm --no-deps smoke
docker compose -f compose.smoke.yaml exec -T api node -e "if (process.getuid() === 0) process.exit(1)"
docker compose -f compose.smoke.yaml down
```

This creates a separate PostgreSQL database with synthetic credentials and an internal network that prevents outbound email delivery. The smoke probe runs in another container on that network and checks the API through its service hostname. No host port is exposed. It neither uses nor resets the developer's normal database.

## Rollback and failure handling

Do not promote a deployment with failed migrations or readiness. Inspect safe application errors and provider status without exporting secret-bearing environment values or email payloads. Roll back application code only when it remains compatible with the current schema; prefer expand-and-contract migrations and forward fixes. Redeploying an older image does not reverse a database migration.

If delivery is rejected permanently, inspect the sender configuration and provider dashboard, fix the configuration, and use a reviewed administrative recovery operation for affected jobs. Never replay sensitive account emails indiscriminately, and request fresh verification or recovery links when old tokens have expired.

Official references: [Railway configuration](https://docs.railway.com/config-as-code/reference), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), and [Resend send API](https://resend.com/docs/api-reference/emails/send-email).
