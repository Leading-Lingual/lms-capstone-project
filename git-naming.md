# Thriving in Tech LMS Git and Naming Conventions

## Purpose

This file defines Git workflow, branch names, commits, pull requests, code names, and formatting for the Thriving in Tech LMS MVP. Use it alongside `instruction.md` and the MVP PRD. Backend code uses Express.js with TypeScript.

Codex and all contributors must follow these rules when creating branches, preparing commits, suggesting commit messages, or drafting pull requests.

---

## 1. Branch Naming Convention

Branch names must be:

- Short and descriptive.
- Written in lowercase only.
- Separated with hyphens.
- Named after the work being completed, not after the contributor.
- Focused on one feature, fix, or main task.

### Allowed branch formats

| Work type         | Format                   | Example                       |
| ----------------- | ------------------------ | ----------------------------- |
| Feature           | `feature/<feature-name>` | `feature/user-authentication` |
| Bug fix           | `fix/<issue-name>`       | `fix/email-verification-error`  |
| Production hotfix | `hotfix/<issue-name>`    | `hotfix/submission-upload-failure`      |
| Refactor          | `refactor/<area>`        | `refactor/auth-module`        |
| Chore             | `chore/<task>`           | `chore/setup-eslint`          |
| Documentation     | `docs/<topic>`           | `docs/api-documentation`      |
| Test              | `test/<area>`            | `test/authentication-flow`    |

### Project examples

```text
feature/course-enrolment
feature/assignment-submissions
fix/draft-grade-visibility
refactor/database-connection
chore/update-dependencies
docs/course-api
test/authentication-flow
```

### Invalid branch names

Do not use vague or personal branch names such as:

```text
feature/new
fix/test
divine-branch
marvellous-update
my-branch
```

### Codex branch rule

When asked to suggest or create a branch name, Codex must:

1. Identify the type of work.
2. Select the correct branch prefix.
3. Use a clear lowercase description with hyphens.
4. Keep the branch focused on one logical task.

---

## 2. Main Branches

### `main`

- Contains production-ready code.
- Direct pushes are not allowed.
- Changes must reach `main` through a reviewed pull request.

### `staging`

- Serves as the integration branch for completed work before production release.
- It should be introduced when the project has its first working MVP. Before it exists, target reviewed pull requests at `main`; once introduced, normal work targets `staging`, and reviewed release pull requests promote `staging` to `main`.
- A production hotfix targets `main` through review and must also be brought into `staging` if that branch exists.

### Working branches

- `feature/*` — new features and functionality.
- `fix/*` — non-production bug fixes.
- `hotfix/*` — urgent fixes for production issues.
- `refactor/*` — code restructuring without changing behaviour.
- `chore/*` — maintenance and configuration work.
- `docs/*` — documentation changes.
- `test/*` — test additions or updates.

---

## 3. Commit Message Convention

Use Conventional Commit-style messages.

### Format

```text
<type>: <short description>
```

### Allowed commit types

| Type       | Use for                                       | Example                                |
| ---------- | --------------------------------------------- | -------------------------------------- |
| `feat`     | New functionality                             | `feat: add user registration`          |
| `fix`      | Bug fixes                                     | `fix: reject expired reset tokens`       |
| `refactor` | Code restructuring without changing behaviour | `refactor: restructure auth module`    |
| `chore`    | Maintenance and configuration                 | `chore: configure eslint and prettier` |
| `docs`     | Documentation changes                         | `docs: update API documentation`       |
| `test`     | Adding or updating tests                      | `test: add authentication tests`       |
| `style`    | Formatting or styling changes                 | `style: update code formatting`        |
| `perf`     | Performance improvements                      | `perf: optimise course progress query`     |
| `build`    | Build system or dependency changes            | `build: update build configuration`    |
| `ci`       | CI/CD changes                                 | `ci: add pull request checks`          |

### Project examples

```text
feat: add assignment submission flow
fix: hide unpublished grades from students
refactor: simplify authentication service
chore: update project dependencies
docs: add course API documentation
test: add course enrolment tests
perf: optimise course dashboard query
ci: add pull request checks
```

### Commit rules

- Use the imperative form: `add`, `fix`, `update`, `remove`, or `refactor`.
- Do not use past tense such as `added`, `fixed`, or `updated`.
- Keep the first line concise, ideally under 72 characters.
- Describe what changed clearly.
- Keep each commit focused on one logical change where possible.
- Do not use vague messages.

### Invalid commit messages

```text
changes
updates
fixed stuff
work done
final fix
misc changes
```

### Codex commit rule

When Codex suggests a commit message, it must:

1. Choose the correct commit type.
2. Use an imperative description.
3. Describe one logical change.
4. Keep the subject concise.
5. Avoid a trailing full stop in the subject line.

---

## 4. Pull Request Convention

Every feature, fix, refactor, or other shared change must be submitted through a pull request before it is merged into a shared branch.

### PR title format

```text
<type>: <short description>
```

### PR title examples

```text
feat: add user authentication
fix: resolve email verification issue
refactor: restructure courses module
```

The PR title should use the same type conventions as commit messages.

### Required PR description

Every pull request description must explain:

1. **What was changed?**
2. **Why was the change made?** Include the relevant FR01 to FR11 requirement or supporting MVP quality requirement.
3. **Verification** State actual checks and outcomes, including checks not run.
4. **Migration or operational impact** Describe database, configuration, provider, or rollout changes when applicable.

### Recommended PR template

```markdown
## What was changed?

- Describe the implementation or files changed.
- Keep the explanation specific to this pull request.

## Why was this change made?

- Explain the problem, requirement, or reason for the change.

## Verification

- State how the change was tested or reviewed.
```

Codex must not claim that tests passed unless the tests were actually run successfully.

---

## 5. General Team Rules

- Keep each branch focused on one feature, fix, or main task.
- Update from the latest target branch before opening a pull request when appropriate. Avoid rewriting a shared branch or force-pushing without explicit coordination.
- Avoid committing generated files unless the repository intentionally tracks them.
- Never commit secrets, credentials, API keys, tokens, or private keys.
- Never commit `.env` files containing real secrets.
- Use `.env.example` to document required environment variables with placeholder values.
- Review staged files before committing.
- Do not push directly to `main`.

### Secret-safety checks

Before suggesting a commit, Codex should check that the staged work does not include:

```text
.env
.env.local
.env.production
private keys
service-account credentials
access tokens
API secrets
database passwords
```

If an environment variable is required, add its name to `.env.example` without adding the real value.

---

## 6. Formatting and Code Quality

Use the repository's configured formatter and linter.

Accepted tools include:

- Prettier.
- ESLint.
- Biome.

Follow the existing repository configuration. Do not introduce a second formatter or linter when one is already configured unless the team explicitly approves the change.

Before a pull request is opened, run the relevant formatting, linting, and test commands defined in `package.json` or the repository documentation.

---

## 7. Codex Operating Instructions

When working in this repository, Codex must follow this sequence:

1. Understand the requested task and keep the change within that scope.
2. Suggest or use a branch name that follows this document.
3. Make focused changes without unrelated refactoring.
4. Follow the Express.js architecture in `instruction.md` and preserve the configured formatter and linter.
5. Avoid exposing or committing secrets.
6. Run the available linting, formatting, and testing commands when possible.
7. Suggest a Conventional Commit message for the completed change.
8. Draft a pull request title and description using the required format when requested.
9. State clearly when a command or test was not run.

### Example Codex output

```text
Branch: feature/assignment-submissions
Commit: feat: add assignment submission endpoint
PR title: feat: add assignment submission endpoint
```

---

## 8. Quick Reference

### Branch

```text
feature/assignment-submissions
```

### Commit

```text
feat: add assignment submission endpoint
```

### Pull request title

```text
feat: add assignment submission endpoint
```

### Pull request description

```markdown
## What was changed?

- Add the assignment submission endpoint for FR07.
- Validate course enrolment, submission state, and file status.

## Why was this change made?

- FR07 requires enrolled students to submit work and receive a confirmation.

## Verification

- State the exact checks run and their outcomes; list checks not run.
```

---

## 9 Code and Domain Naming

Use names from the MVP PRD consistently across code, APIs, database models, and tests.

| Item | Convention | Example |
| --- | --- | --- |
| Domain folders | Lowercase kebab-case | `courses`, `submissions`, `live-classes` |
| Express route files | `<domain>.routes.ts` | `assignments.routes.ts` |
| Controllers and services | `<domain>.controller.ts` and `<domain>.service.ts` | `grading.service.ts` |
| Repositories and validation | `<domain>.repository.ts` and `<domain>.schema.ts` | `enrolments.schema.ts` |
| Middleware | `<purpose>.middleware.ts` | `authenticate.middleware.ts` |
| Tests | `<subject>.test.ts` in the appropriate test folder | `grade-publication.test.ts` |
| Types and classes | PascalCase | `SubmissionReceipt`, `CourseService` |
| Functions and variables | camelCase with descriptive action names | `publishGrade`, `courseId` |
| Constants and enum values | UPPER_SNAKE_CASE | `MAX_UPLOAD_BYTES`, `LECTURER` |
| API resources | Plural lowercase kebab-case under `/api/v1` | `/api/v1/courses`, `/api/v1/live-classes` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `EMAIL_PROVIDER` |
| Migration names | Descriptive snake_case | `add_submission_versions` |

Use `Student`, `Lecturer`, and `Administrator` in product text; application roles are `STUDENT`, `LECTURER`, and `ADMIN`. Prefer the PRD spelling `enrolment` in project-owned names. Use `CourseModule` for a learning module so it is distinguishable from a backend code module.

Use names for actual business states, such as `DRAFT`, `PUBLISHED`, and `CANCELLED`, rather than vague flags. Keep course publication and archival separate. Keep submission lateness separate from grading status. Use UTC timestamps with clear names such as `submittedAt`, `publishedAt`, and `deadlineAt`.

Match the schema's selected table and column mapping consistently. Avoid mixing database naming conventions or renaming shared fields without a migration and API compatibility plan. Do not use framework decorators, guards, or framework-specific file naming from the previous backend design.

Feature branches should describe one deliverable within the PRD, such as `feature/lesson-progress`, `feature/live-class-scheduling`, or `feature/grade-publication`. Deferred features require a recorded scope change before implementation.

## 10 Documentation and Repository Readiness

Documentation-only changes should use a `docs/*` branch and a `docs:` commit, for example:

```text
Branch: docs/align-lms-mvp-instructions
Commit: docs: align engineering guidance with LMS MVP
PR title: docs: align engineering guidance with LMS MVP
```

This workspace may contain planning documents before a Git repository or application exists. Check repository status and available scripts first. Do not claim a branch, commit, pull request, build, or test run exists when it does not. Do not initialise Git, create remotes, commit, push, or open a pull request merely to update documentation unless that action is part of the user's request.

These conventions may be updated as the team and workflow grow. Any change to this file should be reviewed and agreed upon by the team.
