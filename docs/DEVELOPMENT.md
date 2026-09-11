# CampusFlow Ops development log

## Starting point

The existing `master` history contains `e44e783` (Initial commit) and `acbc1ce` (Added README). Preserve that history. The original React/Express/MongoDB academic application remains available as we add campus operations.

## Accepted scope

- Preserve the approachable purple campus identity; improve responsive layout, keyboard access, contrast, focus, motion preferences, and useful error states.
- Equipment requests, faculty approval/rejection with reasons, inventory allocation, collection, and return.
- Enforce permissions on the server, prevent conflicting allocations and duplicate requests, and preserve action history.
- Calendar integration with recoverable failures; failures must not undo an approval or duplicate an external event.
- Test the workflow and its failure cases, commit working milestones, and document the actual architecture and setup.
- Capture screenshots from the running app, publish an accurate README, and deploy the frontend on Vercel.
- Keep demo records clearly labelled and isolated from real campus data.

## Milestones

1. Repository hygiene and reproducible tooling.
2. Accessible CampusFlow shell and operations interface.
3. Transactional workflow API, permissions, persistence, and integration recovery.
4. End-to-end verification, polish, screenshots, and documentation.
5. Deployment and live smoke checks.

The preferred new backend is Java/Spring Boot with SQL. Vercel does not provide the persistent JVM host it requires; hosting access or a fully Vercel-compatible alternative must be resolved before claiming a live backend deployment.

## Evidence policy

Use actual test results and real screenshots. Sample data, demo integration simulations, and local development stores must be explicitly identified. Do not claim real campus adoption, production traffic, or performance improvements without measurements.

## Completed milestones

- `cb45926`: repository hygiene and local configuration protection.
- `f6d4471`: Spring Boot workflow, SQL persistence, security and recovery tests.
- `1982f1a`: accessible operations workspace and refreshed welcome page.
- `1cfec36`: browser tests, keyboard/contrast fixes and old React warning cleanup.
- `3f48468`: peak reservation algorithm, physical handoff checks and isolated tests.

- `2a88f3c`: real screenshots, reproducible workflow graphic, CI and deployment runbook.
- `ba4b414`: Vercel same-origin proxy, cold-start loading and explicit academic demo boundaries.

The new history is pushed as a fast-forward to the existing remote `main` branch. Original commits and their dates are preserved. The frontend is deployed to Vercel and Spring Boot is connected to a separate Render PostgreSQL database. No database migration from MongoDB is involved. See `DEPLOYMENT.md` for verification evidence and hosting limits.
