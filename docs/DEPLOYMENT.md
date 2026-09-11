# Deployment and verification

The frontend runs on Vercel. The Spring Boot API runs as a Docker web service on Render, with a separate PostgreSQL database in Singapore. `/api/ops/*` must be proxied from Vercel to the Java service so HttpOnly cookies stay on the frontend origin.

## Current status

- Local production frontend build passed with `CI=true`.
- 16 Java tests passed using isolated H2 databases and PostgreSQL 18 in GitHub Actions.
- 13 browser tests passed, including the full workflow and automated accessibility scans.
- Real app screenshots are in `docs/screenshots/`; reproducible script: `npm run screenshots`.
- Vercel project: `samsh2/campusflow-ops`.
- Render database: `campusflow-ops-db`, PostgreSQL 18, Singapore.
- Live frontend: https://campusflow-ops.vercel.app
- Live Spring Boot service: https://campusflow-ops.onrender.com
- Render successfully connected to PostgreSQL 18.6, applied migration V1 and returned `UP` from `/actuator/health` on 12 September 2026 (IST).
- Backend deployment revision: `2a88f3c`; frontend deployment includes `ba4b414`. The Java source is identical across these revisions.
- PostgreSQL and browser CI: [successful run 34597902279](https://github.com/Sammmmsh/CampusFlow/actions/runs/34597902279).
- All 13 Playwright tests passed against the public Vercel URL on 12 September 2026: full handoff journey with reload persistence, calendar failure/recovery, forbidden role actions, search, mobile navigation, seven axe page scans and keyboard/dialog checks.
- Live session checks confirmed `Secure`, `HttpOnly`, `SameSite=Lax`, and `private, no-store`. Missing CSRF tokens and untrusted origins both returned HTTP 403.
- The seven README screenshots were recaptured from the deployed Vercel site.

The Render **free PostgreSQL database expires on 11 October 2026**. It is suitable for a temporary portfolio demo. Move the operations data to a durable PostgreSQL plan or another provider before that date if the demo must remain available. No paid plan was enabled. The free Java instance also sleeps after inactivity, so its first request can take longer.

## Recreate the deployment

1. Create a new PostgreSQL database for operations. The academic MongoDB database remains independent.
2. Deploy the repository's `main` branch as a Render **Docker** web service in the same region as PostgreSQL.
3. Set Dockerfile path to `ops-service/Dockerfile`, build context to `ops-service`, and health check to `/actuator/health`.
4. Set `JDBC_DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `APP_ORIGIN` (the exact frontend origin), `COOKIE_SECURE=true` and `DEMO_ENABLED=true` in the service environment. Never commit credentials. The default H2 file is local development storage and must not be used as persistent production storage on an ephemeral host.
5. Deploy `frontend/` as a Create React App project on Vercel. Use `npm ci`, `npm run build`, and output directory `build`.
6. Configure the `/api/ops/:path*` rewrite to the actual Render service, followed by the SPA route fallback. Keep API responses uncacheable.
7. Verify session creation, CSRF, the full role workflow, database persistence and outage recovery through the Vercel URL. Verify `/actuator/health` returns `UP` on the Java host.

Public-repository Render deployments may require a manual deploy after later Git pushes. Never assume a new commit is live; inspect the deployed revision.

## Demo boundaries

- The Vercel deployment excludes local `.env` files. Academic sign-in is intentionally unavailable without the original Express service; the operations workflow is the live demo. Existing MongoDB data has not been migrated or modified.
- Calendar delivery uses the labelled simulator. The optional Google Calendar adapter has not been tested with live credentials.
- This is a portfolio demo, not a production campus system. The inherited Create React App dependency tree still reports npm audit advisories, including critical advisories; dependency modernization remains separate work. Do not process real campus records or build untrusted contributed code with this setup.
- The bundled Flyway version warns that PostgreSQL 18 is newer than its tested support range. Migration V1 succeeded on Render and the application tests passed on PostgreSQL 18 in CI; this is not a claim of complete version certification.

## Calendar setup

The default provider is a simulator and is labelled in the interface. Enabling the Google provider requires both `GOOGLE_CALENDAR_ID` and `GOOGLE_CALENDAR_ACCESS_TOKEN`. Use a dedicated test calendar, not a personal production calendar. Tokens expire; this implementation does not automatically refresh OAuth tokens. Do not claim a verified live integration until a real event has been created and a retry has been checked.

## Troubleshooting

- **401 on the first session read:** expected; the UI then creates an isolated demo session.
- **403 on a mutation:** check `APP_ORIGIN`, the HttpOnly cookie and `X-CSRF-Token`. Do not disable the checks.
- **409 on approval:** another approved booking occupies the requested capacity. Change the slot or quantity.
- **409 on collection:** another user still has the units checked out. Record a return first.
- **Calendar job failed:** approval is saved. Recover the demo provider or fix the live token, then retry.
- **Java cannot repackage its JAR on Windows:** stop your own running preview before building again; Windows locks open JAR files.
- **Maven wrapper cannot download Maven:** use an installed Maven 3.9+ from the official distribution.
- **Git asks which saved account to use:** use the account that owns the repository. Do not rewrite or backdate commit history.
