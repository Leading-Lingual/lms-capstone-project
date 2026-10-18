# Thriving in Tech LMS MVP Backend Engineering Instructions

- **Version:** 2.1
- **Updated:** 18 October 2026
- **Audience:** Backend engineers, deployment engineers, and coding assistants
- **Product:** Thriving in Tech Learning Management System
- **Scope reference:** [MVP PRD](Thriving%20in%20Tech%20LMS%20MVP%20PRD.md)
- **Backend framework:** Express.js with TypeScript
- **Architecture:** Modular monolith
- **Database:** PostgreSQL

## 1 Purpose and authority

Implement the LMS first release around enrolment, course delivery, live class links, assignments, and lecturer feedback. This document replaces the unrelated project instructions previously in this folder.

Follow explicit user decisions, the MVP PRD and approved product changes, these engineering conventions, and committed API contracts in that order. Follow `git-naming.md` for branches, commits, pull requests, and code names. Do not interpret proposals in the draft PRD as established program facts. Preserve their proposed status until confirmed; record decisions in `docs/architecture-decisions/` and update the PRD when scope changes.

Express.js is the application framework used to implement the backend. Node.js is the runtime that executes Express.js; it is not a competing framework. Use Express routers, middleware, and application services rather than a bare HTTP server or another backend framework.

## 2 MVP scope and requirement mapping

| PRD requirement | Owning domain | Required backend behaviour |
| --- | --- | --- |
| FR01 Account access | auth | Student registration, lecturer registration pending approval, email verification, login, logout, password recovery, and controlled first administrator setup |
| FR02 User and enrolment administration | users and enrolments | Administrator role changes, lecturer approval, account deactivation, lecturer assignment, and student enrolment removal |
| FR03 Course and lesson management | courses and lessons | Administrator course shells and publishing; assigned lecturer modules, ordered lessons, text, resource files, hosted video links, and lesson publication |
| FR04 Learning progress and dashboards | progress and dashboards | Persistent completion and reopening; course progress, next incomplete lesson, class schedule, deadlines, announcements, and pending grading |
| FR05 Live class scheduling | live-classes | Lecturer scheduling, edits, cancellation, time zones, and manually supplied Zoom links |
| FR06 Class recordings | recordings | Published hosted recording links associated with a lesson or class |
| FR07 Assignments and project submissions | assignments and submissions | Instructions, rubric, deadline, maximum score, confirmed submissions, replacements, late labels, and explicit reopening |
| FR08 Grading and feedback | grading | Draft and published grades, score validation, written feedback, notification, and retained change history |
| FR09 Course announcements | announcements | Course notices, one pinned announcement, audience restriction, publication and unpublication |
| FR10 Essential notifications | notifications | In-app items, read status, event emails, transactional account emails, one deadline reminder, deduplication, and retries |
| FR11 Basic administrative reports | reports and admin | Enrolment counts, progress and submission status views, and administrator-only CSV export |

Supporting infrastructure includes private uploads, audit logs, health checks, error monitoring, backups, migrations, and deployment documentation.

### Deferred features

Do not implement mentorship booking, discussion forums, portfolios, job listings or application tracking, certificates, Google sign-in, automatic lesson release, scheduled announcements, recurring meeting scheduling, detailed analytics, automatic Zoom meeting creation, recording imports, native video hosting, or native mobile APIs as separate products. Do not add quizzes, payments, reward systems, or unrelated product domains to the first release.

Use standard HTTP APIs. Do not add microservices, MongoDB, a second notification database, Redis, message brokers, or WebSockets without a recorded and measured requirement. A PostgreSQL-backed delivery queue can support the pilot's durable notifications without adding a broker.

## 3 Technology and dependency policy

| Concern | Direction |
| --- | --- |
| Application framework | Express.js with TypeScript in strict mode |
| Runtime | Supported Node.js LTS compatible with selected dependencies |
| Database | PostgreSQL for users, courses, submissions, notifications, and audit records |
| Data access | Retain Prisma ORM as the engineering default; review any replacement in an architecture decision |
| Validation | Zod or the team's single selected schema validator at external boundaries |
| File storage | Private AWS S3 or Cloudinary storage with verified support for the required private file types; provider selection remains open |
| Video and meetings | External hosted videos and manually entered Zoom and recording links |
| Email | Resend for hosted deployments through a provider interface; private mailbox for local development |
| API documentation | OpenAPI contract matching actual routes and schemas |
| Logging and security | Structured request logs, security headers, explicit CORS allowlist, and authentication and upload rate limits |
| Hosting | Railway staging using the root Dockerfile and railway.json; see the staging runbook |

Do not preserve the old file's claimed package versions or provider commitments. Verify official documentation and package compatibility during setup, choose supported stable releases, commit `package-lock.json`, and use `npm ci` in CI. Keep the Prisma CLI and client on compatible matching versions. Install dependencies only when their associated feature is being built. Review major upgrades and security findings explicitly.

The frontend remains a responsive web application as defined in the PRD. This file guides backend implementation and the API contracts supporting that frontend.

## 4 Application structure

Use one deployable API with clear domain boundaries. Keep route handlers thin; put business rules in services and database operations in domain-owned repositories. External storage, email, and malware scanning providers belong behind infrastructure interfaces.

```text
backend/
  src/
    app.ts                 # Build the Express app without opening a port
    server.ts              # Start HTTP server and handle graceful shutdown
    config/
      env.schema.ts
    middleware/
      authenticate.middleware.ts
      authorize.middleware.ts
      validate.middleware.ts
      error-handler.middleware.ts
      request-id.middleware.ts
    infrastructure/
      database/
      storage/
      email/
      malware-scanner/
      observability/
    modules/
      auth/
      users/
      enrolments/
      courses/
      lessons/
      progress/
      dashboards/
      live-classes/
      recordings/
      assignments/
      submissions/
      grading/
      announcements/
      notifications/
      reports/
      admin/
      audit/
      health/
    jobs/
      notification-delivery.job.ts
      assignment-reminder.job.ts
  prisma/
    schema.prisma
    migrations/
    seed.ts
  test/
    integration/
    e2e/
    fixtures/
  docs/
    openapi.json
    architecture-decisions/
    runbooks/
  .env.example
  package.json
  package-lock.json
  tsconfig.json
```

Each domain may contain `<domain>.routes.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.repository.ts`, `<domain>.schema.ts`, and `<domain>.policy.ts` as needed. Do not create empty abstractions merely to fill the tree. Call other domains through explicit services or interfaces; do not reach into their internal repositories.

Use middleware in deliberate order: request IDs and logging, HTTP security and CORS, size-limited parsers, authentication, route validation and authorisation, route handlers, not-found handling, then the final four-argument Express error handler. Public authentication and health routes need explicit exceptions to authentication. Upload routes use their own bounded multipart parser. Set proxy trust to the actual deployment topology.

## 5 Authentication and permissions

Use only `STUDENT`, `LECTURER`, and `ADMIN` application roles. Store roles, lecturer approval, verification, and account status in authoritative server data. Public registration must never grant administrator or approved lecturer access.

Use the application-owned email and password implementation with hashed opaque sessions recorded in the foundation architecture decision. Follow the same verification, recovery, revocation, and approval rules below. Replacing this with a managed provider requires a reviewed architecture decision; do not build competing session systems. See [the Railway staging decision](backend/docs/architecture-decisions/0002_railway_staging.md) for current deployment and email settings.

- Require verification before students access learning records and approval before lecturers access teaching tools.
- Hash application-owned passwords with an approved password-hashing implementation. Verification and reset tokens must be unpredictable, expiring, single-use, and stored safely.
- Use expiring sessions. Deactivation, logout, and password recovery must have documented revocation behaviour. If using JWTs, verify signature and claims and check active account status; decoding is insufficient.
- For browser cookies, use secure, HttpOnly settings, an intentional SameSite policy, and CSRF protection for authenticated writes. Never log credentials, session tokens, recovery links, or signed file URLs.
- Rate-limit login, registration, verification, and recovery; use generic responses where account enumeration is possible.
- Seed the first administrator through a controlled non-public operation with no committed default password.

Every course operation requires a server-side course membership or assignment check as well as role checks. Students can see only their own submissions and published grades. Lecturers can manage only assigned courses. Administrators manage users, course shells, course publication, lecturer assignments, enrolment, archive operations, and cross-course reports. Assigned lecturers publish lessons within those courses.

Removing an enrolment immediately blocks protected course access. Archived courses remain readable to existing members but reject new learning activity, submissions, grading, announcements, and schedule changes. Administrative access and retention actions must remain explicit and audited. Short-lived signed file URLs cannot be recalled after issuance; define their expiry and deletion strategy accordingly.

## 6 Data model and invariants

Model at least these records. Adjust field names through reviewed migrations without changing their business meaning.

| Record | Required relationships and state |
| --- | --- |
| User and profile | Unique normalised email, role, verification, active status, lecturer approval, safe profile fields |
| Authentication records | Session or provider subject, recovery and verification state appropriate to the chosen strategy |
| Course | Title, description, draft or published visibility, independent archive timestamp, administrator owner |
| CourseLecturer and Enrolment | Course and user relationships, assignment or membership state, timestamps |
| CourseModule and Lesson | Course relationship, ordered position, content, draft or published status, video links |
| ResourceFile | Private server-generated storage reference, uploader, owning resource, type, bytes, scan status |
| LessonCompletion | Student and lesson relationship, completion state and timestamps |
| LiveClass | Course, title, start instant, IANA time zone, duration, Zoom URL, scheduled or cancelled status |
| Recording | Lesson or class association, hosted URL, publication state |
| Assignment | Course, instructions, optional rubric, deadline, positive maximum score, publication state |
| Submission and SubmissionVersion | Student and assignment, latest accepted version, file or URL, receipt, submitted time, retained versions, replacement lock or reopened state |
| Grade and GradeHistory | Submission, score, written feedback, draft or published state, actor, publication time, retained revisions |
| Announcement | Course, author, content, publication state, pinned flag |
| Notification and DeliveryJob | Recipient, event key, protected target, read time, channel, delivery state, attempt count, next retry time |
| AuditLog | Actor, action, target, request ID, time, minimal redacted change metadata |

Required constraints and transactions:

- Unique `(courseId, studentId)` enrolment, `(courseId, lecturerId)` assignment, and `(studentId, lessonId)` completion.
- Preserve progress when a lesson is unpublished. Compute progress over currently published lessons only; an empty course is zero. Publish a new lesson without duplicating completion records.
- Protect ordering, course relationships, valid scores, positive duration, and assignment maximum score with validation and database constraints where feasible.
- One active submission per student and assignment, with immutable prior versions. A submission requires a validated file or project URL before a receipt is committed.
- Late means the confirmed submission time is after the deadline. Missing means no confirmed submission after the deadline. Graded is independent of late status.
- Replacement is permitted until grading is published. Publishing a grade locks replacement. An explicit lecturer reopening preserves versions and grading history; it does not silently delete prior results.
- Prevent concurrent replacement and grade publication from leaving a grade associated with the wrong version. Use a transaction with row locking or optimistic version checks.
- Atomically save grade publication, audit history, and notification intent. Do not call external email services while holding a transaction open.
- Permit at most one pinned announcement per course. Protect concurrent pinning in a transaction.
- Use unique event-recipient-channel keys for deliveries and idempotent completion and submission operations. Reusing an idempotency key with a changed payload returns a conflict.
- Use UTC timezone-aware database timestamps and ISO 8601 API values; retain an IANA time zone for class scheduling. Validate deadlines and instants rather than assuming the server's local time zone.
- Commit migrations. Never edit an already-applied shared migration or reset a production database. Use separate restricted runtime and migration credentials.

## 7 Files and external links

The PRD proposes 25 MB per file and one file per submission. Confirm these limits with pilot instructors before release. Lesson resources support PDF, PPTX, and DOCX; submissions support PDF, DOCX, and ZIP, plus a repository or project URL. Treat an optional rubric as a permitted lesson-resource type. Do not substitute the former image-only upload policy.

Enforce request and multipart limits before buffering. Validate declared type, extension, file signature, and document structure where appropriate. DOCX and PPTX are archive containers; inspect their format rather than classifying every ZIP signature as a valid document. Bound archive inspection and reject unsafe paths or decompression bombs. Never extract or execute student ZIP files on the application host.

Upload to private quarantine storage; scan before authorising downloads or confirming a usable submission. Keep an explicit pending state if scanning is asynchronous. A failed upload or rejected scan must not appear as a successful submission. Generate storage keys on the server, authorise each download, use short-lived URLs, and define orphan-file cleanup. Unavailable scanning must not silently bypass the check.

Validate HTTPS video, recording, repository, and Zoom links using approved provider policies. Open links without automatically fetching arbitrary URLs from the server. Do not expose joining links to non-members. Cancelled classes cannot be joined through the LMS. Recording host permissions must separately protect external playback where required.

## 8 Notifications and background work

Persist notification intent in PostgreSQL with retry state. Run a scheduled dispatcher or worker with atomic job claiming and expiry of abandoned leases so restarts do not lose work and concurrent workers do not claim the same active delivery.

- Announcements, new or changed classes, and published feedback create in-app items and email jobs for eligible recipients.
- Rescheduling updates the stored class and its dashboard data. A cancellation disables joining and notifies affected recipients.
- Queue one assignment reminder for 24 hours before the deadline. Assignments published within 24 hours of the deadline get no separate reminder. Changes or cancellation invalidate stale reminder jobs; recheck assignment version, due time, and recipient eligibility before delivery.
- Verification and recovery email are transactional account messages.
- Pinning an announcement does not send it again. Read status belongs to the recipient and does not affect another recipient's item.
- Use bounded retries and backoff for retryable provider failures, expose failed delivery status to administrators, and keep email failure from rolling back an otherwise successful learning action.
- Database deduplication prevents repeated local jobs. Use provider idempotency where available and document the residual duplicate-email risk after ambiguous provider responses; do not claim guaranteed exactly-once external delivery.

## 9 API conventions

Use `/api/v1` and OpenAPI as the frontend contract. Use JSON request and response schemas and bounded pagination. Express routes should support these resource groups; final endpoint names must be reviewed in the contract before implementation.

| Resource group | Required operations |
| --- | --- |
| auth | Register, verify email, login, logout, forgotten password, reset password, current account |
| users and admin/users | Own safe profile, approve lecturers, change roles, deactivate accounts |
| courses | Create shell, assign lecturer, enrol or remove student, publish, archive, read enrolled or assigned courses |
| modules and lessons | Ordered content management, resource attachment, publish or unpublish, student reading |
| progress and dashboards | Complete or reopen own lesson, student and lecturer dashboard summaries |
| classes and recordings | Schedule, edit, cancel, list, protected joining links, published recording links |
| assignments and submissions | Create and publish, own submission and receipt, replace, lecturer review, explicit reopening |
| grades | Save draft, publish score and feedback, read own published result |
| announcements | Publish, unpublish, pin, list course notices |
| notifications | List own items, mark read, administrative delivery-failure view |
| admin/reports | Course counts, student progress, submission statuses, CSV export |
| health and ready | Public liveness without database calls; readiness including database connectivity |

Use a consistent success envelope with `data` and a request ID. Errors contain a stable `code`, safe `message`, optional field errors, and request ID. Use appropriate HTTP status codes for validation, unauthenticated access, forbidden access, missing resources, conflicts, rate limits, and provider failures. Do not expose the existence of another student's private record in an error. Never return stack traces, SQL, internal storage paths, or secrets.

Document roles, course membership, request schemas, response schemas, state transitions, idempotency, errors, and rate limits per endpoint. CSV exports remain administrator-only; guard against spreadsheet formula injection in user-controlled text fields.

## 10 Configuration and operations

Use a validated `.env.example` with placeholders for application port and environment, database connections, frontend origin allowlist, deployment proxy configuration, selected auth settings, storage configuration, email configuration, upload and request limits, signed URL expiry, and logging. Require provider-specific secrets only when that provider is selected. Never log the complete environment or commit real credentials.

Use HTTPS, security headers, strict input validation, least-privilege database and storage access, and safe parameterised queries. Keep logs and audit records free of passwords, tokens, recovery links, private submission contents, raw grades unless explicitly required in protected audit history, and unnecessary personal details. Audit account and role changes, lecturer approval, enrolment changes, course and lesson publication, grade publication and edits, and reopening actions.

Log request ID, route template, status, duration, and safe error codes. Monitor database failures, upload and scanning errors, notification retries, submission confirmations, API latency, and readiness. Instrument course opens, lesson activity, and submission attempts for the pilot measures without introducing detailed analytics features.

Separate local, test, staging, and production databases and secrets. Confirm daily database backups and independent object-storage recovery. Perform a restore drill in a non-production environment and document support, incident handling, retention, and deletion procedures.

The proposed pilot target is 100 enrolled users and 30 concurrent users. Verify p95 core API latency within one second, excluding file transfers and external services. The frontend target is key screens usable within three seconds on an agreed representative mobile connection. Proposed recovery targets are at most 24 hours of data loss and restoration within eight hours. These remain proposals pending confirmation, rather than the old project's scale or availability commitments.

## 11 Testing and delivery

Test business rules and failure paths rather than matching internal implementation details. Use real PostgreSQL migrations for integration tests and deterministic provider fakes for email, storage, and scanning failures.

Required coverage includes:

- FR01 to FR11 acceptance criteria, with direct API attempts for every permission boundary.
- Unverified students, pending lecturers, role escalation, deactivated accounts, removed enrolments, draft and archived courses, and cross-student records.
- Persisted and repeated lesson completion, reopened lessons, empty courses, and new publication changing the progress denominator.
- Invalid URLs, daylight-saving and time-zone conversions, rescheduling, cancellation, and hidden recording links.
- Upload failures, oversized files, spoofed types, unsafe archives, scan failures, and pending scans without confirmed submission status.
- Submission receipts, retries, replacements, late work, score limits, draft visibility, grading publication, reopening, and concurrent grading and submission changes.
- Notification deduplication, retry recovery, eligibility changes, and stale assignment reminders.
- Administrator-only reports and exports matching learner records, including late and graded statuses.

Once package scripts exist, CI should run the configured format check, lint, typecheck, meaningful unit and integration tests, build, migration validation, and dependency security review. Run end-to-end tests for the deployed core journey and load-test the proposed pilot capacity before release. Do not claim checks ran when no application or test harness exists yet.

Deliver in the PRD's four stages:

1. Access and structure: authentication, roles, course shells, lecturer assignment, enrolments, and private storage.
2. Learning delivery: lessons, resources, progress, dashboards, class links, and recording links.
3. Work and communication: assignments, submissions, grading, announcements, notifications, and reports.
4. Pilot readiness: security and accessibility checks, failure testing, performance, recovery, documentation, and deployment.

Build and test the release commit, apply compatible reviewed migrations with controlled credentials, deploy the Express build, run readiness and smoke checks, and monitor errors. Use expand-and-contract for breaking schema changes. Shut down HTTP connections and database pools gracefully. Do not assume a provider, launch date, or package version has been approved solely because it appeared in the previous instructions.

## 12 Definition of done and coding assistant rules

A feature is complete when its mapped PRD acceptance criteria pass, server-side permissions and state transitions are enforced, constraints protect data integrity, meaningful tests and OpenAPI are updated, errors are actionable, logs avoid sensitive data, and any migrations and operational changes are documented.

Release only after an administrator, lecturer, and student complete the full deployed teaching journey; no unresolved critical access, submission-loss, or private-grade issue remains; recovery is verified; and user guidance, API documentation, deployment instructions, and a support process are available. Core frontend flows also need the PRD's responsive and WCAG 2.1 AA checks, including captions or transcripts supplied by instructors.

Coding assistants must identify the owning domain and FR requirement, keep work in MVP scope, use Express.js conventions, state invariants and permission checks, define transaction and retry behaviour, follow `git-naming.md`, and report what was verified. Keep provider and policy decisions visible in architecture records. Never restore unrelated product modules or implement deferred features without an explicit scope change.

Review this file when scope, provider selection, authentication strategy, supported dependencies, scaling, security findings, or pilot evidence changes.

## 13 Official implementation references

- [Express middleware](https://expressjs.com/en/guide/using-middleware/)
- [Express production security](https://expressjs.com/en/advanced/best-practice-security/)

Verify version-specific behaviour against official documentation during implementation. These references do not imply that packages or infrastructure have already been installed.
