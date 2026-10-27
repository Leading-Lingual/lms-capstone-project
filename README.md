# Thriving in Tech LMS

This project implements the web LMS defined in [the MVP PRD](Thriving%20in%20Tech%20LMS%20MVP%20PRD.md). The first implementation is an Express.js and TypeScript backend with PostgreSQL and Prisma.

See [the backend guide](backend/README.md) for local setup, authentication, API documentation, checks, and implementation status. Follow [engineering instructions](instruction.md) and [Git and naming conventions](git-naming.md) when contributing.

There is no frontend yet. The complete MVP is still under implementation.

Railway staging is prepared through the root Dockerfile and `railway.json`. See the [deployment runbook](backend/docs/runbooks/railway-staging.md) for service setup, secrets, migration permissions, and verification.
