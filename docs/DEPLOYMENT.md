# Deployment and verification

The frontend runs on Vercel. The Spring Boot API runs as a Docker web service on Render, with Neon PostgreSQL in Singapore. `/api/ops/*` must be proxied from Vercel to the Java service so HttpOnly cookies stay on the frontend origin.

## Current status

- Local production frontend build passed with `CI=true`.
- 25 Java tests passed using isolated H2 databases and PostgreSQL 18 in GitHub Actions.
- 15 browser tests passed locally, including account invitations, restored bookings, the full workflow and automated accessibility scans.
- Real app screenshots are in `docs/screenshots/`; reproducible script: `npm run screenshots`.
- Vercel project: `samsh2/campusflow-ops`.
- Neon project: `CampusFlow`, PostgreSQL 18, AWS Singapore, Free plan.
- Imported branch: `br-soft-butterfly-b3lpm99o`; database: `neondb`. The initially created `production` branch is separate and empty.
- Live frontend: https://campusflow-ops.vercel.app
- Live Spring Boot service: https://campusflow-ops.onrender.com
- Backend revision `8f3ed42` is live on Render. Both `/actuator/health` and `/actuator/health/liveness` returned HTTP 200 with `UP` after cutover.
- Neon shows successful Flyway V1 and V2 history entries. V2 adds accounts and invitation membership to the imported workflow data.
- Vercel production deployment `dpl_GQynv4eo7oSo7yJRh2LWRjGvZE2b` serves the account UI at the existing public URL.
- [PostgreSQL and browser CI](https://github.com/Sammmmsh/CampusFlow/actions/runs/34701996862) passed for the deployed application source.
- The post-migration live browser run is pending. Attempts from the development network on 13 September returned connection resets/timeouts before the Vercel application loaded. A manual GitHub-hosted check is prepared to verify the public deployment from another network.
- The sign-in screenshot was captured from the running local application; the existing workflow screenshots were captured from the earlier live deployment. Refresh them with the live workflow after verification.

The old Render **free PostgreSQL database expires on 11 October 2026**. It is retained as the migration source and was not deleted. Neon displayed no branch expiry on its Free plan; this is still a quota-limited service, not a promise of permanent free hosting. No paid plan was enabled. The free Java instance sleeps after inactivity, so its first request can take longer.

## Migration record

Neon's importer copied the Render operations database into a new branch on 12 September 2026 at approximately 14:58 IST. Read-only checks found all seven V1 tables and a successful Flyway V1 history entry. Counts in that snapshot were 15 workspaces, 90 equipment records, 76 requests, 232 audit events, three calendar jobs and 15 sessions. The imported database has the standard `plpgsql` extension; the application does not depend on a provider-specific extension.

The earlier importer warning was no longer visible when verification resumed. The copied schema and rows were verified, but the exact warning text was not recovered. This was a snapshot of the sample-workspace deployment, not ongoing replication: sample changes made on the old service after the snapshot are retained only in the old source. Real account registration was introduced after the import. The MongoDB academic database was not part of this migration.

For another migration, pause writes, export PostgreSQL with `pg_dump --format=custom --no-owner --no-acl`, restore into an empty target, compare table counts and Flyway history, update Render's three database variables, then verify sign-in and a complete booking. Keep the source until the new database is verified. Once new writes are accepted, a rollback must preserve those writes rather than simply reconnecting to an older snapshot.

## Idle behavior and free limits

Use `/actuator/health/liveness` for Render's automatic probe. It checks the Java process without querying SQL. `/actuator/health` still checks database connectivity when explicitly requested. Hikari keeps zero minimum idle connections, closes idle connections after about 30 seconds and has no keepalive query. The calendar worker stops querying after three minutes without operations API traffic and resumes after the next request. Pending calendar delivery can therefore wait while the application is idle.

The selected Neon Free plan showed 0.5 GB storage, 100 CU-hours of monthly compute and 5 GB network transfer. Limits and policies can change; check the provider dashboards. High traffic, repeated polling or continuous database queries can consume the allowance. Render and Vercel have their own free-tier limits. There is no keep-alive pinger or paid upgrade configured by this project.

## Recreate the deployment

1. Create a new PostgreSQL database for operations. The academic MongoDB database remains independent.
2. Deploy the repository's `main` branch as a Render **Docker** web service in the same region as PostgreSQL.
3. Set Dockerfile path to `ops-service/Dockerfile`, build context to `ops-service`, and health check to `/actuator/health/liveness`.
4. Set `JDBC_DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `APP_ORIGIN` (the exact frontend origin), `COOKIE_SECURE=true` and `DEMO_ENABLED=true` in the service environment. Never commit credentials. The default H2 file is local development storage and must not be used as persistent production storage on an ephemeral host.
5. Deploy `frontend/` as a Create React App project on Vercel. Use `npm ci`, `npm run build`, and output directory `build`.
6. Configure the `/api/ops/:path*` rewrite to the actual Render service, followed by the SPA route fallback. Keep API responses uncacheable.
7. Verify session creation, CSRF, the full role workflow, database persistence and outage recovery through the Vercel URL. Verify `/actuator/health` returns `UP` on the Java host.

For Neon, use the direct endpoint for JDBC and Flyway. The deployed URL uses `sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory&channelBinding=require`, with username and password in separate environment variables. This validates the hostname and certificate using Java's trust store; see [pgJDBC SSL configuration](https://jdbc.postgresql.org/documentation/ssl/). Never place the password in the repository, JDBC URL or screenshots.

Public-repository Render deployments may require a manual deploy after later Git pushes. Never assume a new commit is live; inspect the deployed revision.

## Check a live deployment

The **Live deployment check** workflow in GitHub Actions is manual. Select `main`, enable its test-data checkbox, and run it after a deployment or migration. It creates fictional `@example.test` accounts and isolated demo bookings, checks the full browser journeys, and captures current application screenshots. It does not send email or touch existing users' bookings. Account test data persists; sample workspaces follow normal cleanup. Screenshots are available as a seven-day artifact. Browser traces are disabled for this live run so generated test credentials are not published in artifacts.

The regular **CampusFlow checks** workflow continues to test isolated databases on pushes and pull requests. A green local CI run does not establish that hosting, API rewrites or production cookies work; use the separate live check for those.

## Demo boundaries

- The Vercel deployment excludes local `.env` files. Academic sign-in is intentionally unavailable without the original Express service; the operations workflow is the live demo. Existing MongoDB data has not been migrated or modified.
- Calendar delivery uses the labelled simulator. The optional Google Calendar adapter has not been tested with live credentials.
- Real operations accounts use password authentication and invitation-assigned membership. Email verification, password recovery and institutional SSO are not implemented; see [accounts and team workspaces](ACCOUNTS.md).
- This is a portfolio demo, not a production campus system. The inherited Create React App dependency tree still reports npm audit advisories, including critical advisories; dependency modernization remains separate work. Do not process real campus records or build untrusted contributed code with this setup.
- The bundled Flyway version warns that PostgreSQL 18 is newer than its tested support range. Migration V1 succeeded on Render and the application tests passed on PostgreSQL 18 in CI; this is not a claim of complete version certification.

## Calendar setup

The default provider is a simulator and is labelled in the interface. Enabling the Google provider requires both `GOOGLE_CALENDAR_ID` and `GOOGLE_CALENDAR_ACCESS_TOKEN`. Use a dedicated test calendar, not a personal production calendar. Tokens expire; this implementation does not automatically refresh OAuth tokens. Do not claim a verified live integration until a real event has been created and a retry has been checked.

## Troubleshooting

- **401 on the first session read:** anonymous visitors can enter a sample workspace; returning account users are asked to sign in again.
- **403 on a mutation:** check `APP_ORIGIN`, the HttpOnly cookie and `X-CSRF-Token`. Do not disable the checks.
- **409 on approval:** another approved booking occupies the requested capacity. Change the slot or quantity.
- **409 on collection:** another user still has the units checked out. Record a return first.
- **Calendar job failed:** approval is saved. Recover the demo provider or fix the live token, then retry.
- **Java cannot repackage its JAR on Windows:** stop your own running preview before building again; Windows locks open JAR files.
- **Maven wrapper cannot download Maven:** use an installed Maven 3.9+ from the official distribution.
- **Git asks which saved account to use:** use the account that owns the repository. Do not rewrite or backdate commit history.
