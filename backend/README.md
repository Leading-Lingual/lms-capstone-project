# LMS backend foundation

This slice implements email registration, verification, login, logout, recovery, lecturer approval, administrator account controls, course shells, lecturer assignments, student enrolment, membership checks, audit history, and durable development email delivery. It starts FR01 and FR02 and the course-shell portion of FR03.

Lessons, resources and upload scanning, live classes, progress dashboards, assignments, grading, announcements, reports, the frontend, and production delivery remain to be implemented. This is a development foundation, not a release-ready LMS.

## Local setup

Requirements: Node.js 24, npm, and Docker with Linux containers. Run these commands from the project root:

```powershell
npm ci
npm run local:setup
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:migrate:test
npm run dev
```

Wait for the PostgreSQL container to become healthy before applying migrations. The database is bound to `127.0.0.1:5436`. Development and test databases are separate and use generated local passwords. Setup preserves an existing `backend/.env`; do not rerun with new credentials against an existing volume. Never use these local credentials in production.

The development API listens at `http://127.0.0.1:5000/api/v1`. Health and readiness are available at `/health` and `/ready`. Set frontend configuration explicitly when a web client is added.

When the frontend runs at `http://localhost:3000`, call the API through `http://localhost:5000` so the browser cookie uses the same site. Do not mix `localhost` and `127.0.0.1` across the frontend and API.

## First administrator

Supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` through your shell environment, then run `npm run admin:create` from the root. The password must contain 12 to 128 characters. The command creates a new verified administrator through a controlled operation; it never overwrites or elevates an existing account and never prints credentials. Remove the temporary environment values afterward.

## Account and course workflow

1. Register a student or lecturer through `POST /auth/register`. Public registration cannot grant administrator privileges.
2. Read the corresponding verification message from `backend/.local/mailbox`. Copy the fragment token from its link into `POST /auth/verify-email` as `{ "token": "..." }`.
3. Sign in through `POST /auth/login`. Lecturers need approval by an administrator first. Store the response cookie and send it on subsequent requests.
4. An administrator creates a course, assigns a lecturer, enrols a student, and publishes the course. The student can now read it; another student cannot.
5. Removing enrolment or deactivating an account blocks subsequent access. Archived published courses remain readable to existing members, while new members and edits are rejected.

For every write, send `Origin: http://localhost:3000`, or another exact configured allowed origin. Browser clients must include credentials. All paths above are relative to `/api/v1`.

The default mailbox is private local development output, excluded from source control. Delivery runs every two seconds. The mailbox sends no real email. The links currently point at future frontend pages; use their tokens with the API until those pages exist. Production requires the Resend transport, a verified sender, provider credentials, and HTTPS frontend configuration; it rejects mailbox delivery.

## API contract and checks

[OpenAPI](docs/openapi.json) defines implemented routes, bodies, responses, roles, membership rules, write-origin requirements, errors, and pagination. Regenerate it with `npm --workspace backend run docs:generate` after changing the contract.

Run from the project root:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test:integration
npm run build
npm audit
```

Integration tests require the migrated isolated test database. They refuse a database whose name does not end in `_test` and clean only the test records. Tests cover verification and recovery token use, revoked and expired sessions, approval, role escalation, deactivation, origin enforcement, throttling, private and draft course access, archive rules, duplicate and concurrent enrolments, email retries, and restricted database credentials.

Migrations are committed under `prisma/migrations`; apply them through the separate `DIRECT_URL` migration credential. Application connections use a restricted runtime account. Never use production data or reset production schemas for tests.

See [the foundation decision](docs/architecture-decisions/0001_backend_foundation.md) for authentication, database, email, and dependency decisions. Storage provider selection, retention and backups, production security review, accessible frontend flows, and pilot load testing remain launch prerequisites.

## Railway staging

The root Dockerfile and `railway.json` prepare an API staging deployment with pre-deploy migrations, a non-root runtime, Resend delivery, and database readiness checks. Follow the [Railway runbook](docs/runbooks/railway-staging.md) and [deployment decision](docs/architecture-decisions/0002_railway_staging.md). Cloud resources and secrets must be configured before a live deployment; no live deployment is implied by these files.
