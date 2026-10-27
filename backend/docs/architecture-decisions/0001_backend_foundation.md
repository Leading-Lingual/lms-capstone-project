# Backend foundation

Date: 12 October 2026

The production restriction and provider-selection status below describe the initial foundation. [Decision 0002](0002_railway_staging.md) supersedes them with Railway staging configuration and Resend support.

The first implementation slice uses Express.js 5 with strict TypeScript, Prisma 7, and PostgreSQL. Prisma 7.10.0 is pinned across the CLI, client, and PostgreSQL adapter; the registry's current Prisma latest tag was a prerelease at setup time. Runtime Node.js 24 is selected independently of Express.js as the backend framework.

Authentication is application-owned. Passwords use Node's scrypt with N 131072, r 8, p 1, a random salt, and constant-time comparison. Random opaque sessions are stored as SHA-256 hashes, expire after at most seven days, and are transmitted only through an HttpOnly SameSite Lax cookie. Every request checks the current account's active status, role, verification, and lecturer approval. Logout, password reset, account deactivation, and role changes revoke sessions.

Browser writes, including login, require an allowlisted Origin header. The API uses an explicit CORS allowlist with credentials. A future frontend should use the same site as the API; cross-site cookie deployment requires a separate reviewed cookie and CSRF design. Non-browser clients must send an allowed Origin header on writes.

Verification and recovery tokens are hashed, expiring, and single-use. Their outbound messages are queued atomically with the token state. Queue payloads use AES-256-GCM encryption with an environment-managed key so raw links are not stored in database plaintext. The local mailbox transport writes private files under `.local/mailbox`; tokens never appear in HTTP responses or application logs. Delivered payloads are cleared. Delivery retries use durable PostgreSQL jobs and lease claiming.

The mailbox is deliberately development-only. Startup refuses production mode until a real email transport is implemented and reviewed. No production hosting or email provider is selected by this foundation. The frontend verification and recovery pages do not exist yet; mailbox links contain fragment tokens that can currently be submitted to the documented API endpoints.

The local PostgreSQL container provides `lms` and isolated `lms_test` databases. Runtime credentials have data-access permissions without superuser or schema-creation privileges. Separate owner credentials run migrations. Tests reject databases whose names do not end in `_test` and never clean the development database.

Course publication and archiving are independent. Administrators create and publish course shells, assign approved lecturers, and enrol verified active students. Students see only published enrolled courses; lecturers see assigned courses. Archived courses remain readable to eligible members and reject new members and content edits. Membership removal remains available for administrative access revocation. Serializable transactions protect membership and account state changes; audit events are saved with their changes.

Prisma's development-tool dependency tree required root overrides for `deepmerge-ts` 8.0.2 and `mysql2` 3.24.5 to resolve npm audit findings. These are not product features or an additional database. Keep the overrides only until upstream packages adopt patched versions; check generation, migrations, build, and tests after updates.

Private course resources, upload scanning, lessons, dashboards, classes, assignments, grading, and course notifications remain future slices. The foundation must not be described as the complete Stage 1 release or the complete MVP.

References: [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [Express error handling](https://expressjs.com/en/guide/error-handling/), and [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
