# Accounts and team workspaces

Open `/ops/sign-in` to sign in, create a workspace, or join a team. The sample workspace remains available without registering.

## Membership

Creating an account without an invitation creates a private workspace with six starter equipment items and no fictional bookings. The creator owns that workspace and can use all three workflow roles. Role selection changes the owner's active session role; it does not grant permissions in another workspace.

The owner creates an invitation from **Account** using a teammate's email and a student, faculty or inventory role. The code is single-use, expires after 48 hours, and must be shared privately. Joining requires both that code and the matching email. Members cannot switch their assigned role or invite other members. Request ownership uses the account ID, so people with the same display name cannot cancel each other's requests.

Emails are identifiers, not verified institutional identities. Invitations are not sent by email. Anyone holding the code and knowing its intended email can redeem it. This is password authentication with invited membership, not university SSO or verified student status.

## Sessions and passwords

- BCrypt hashes passwords; registration accepts at least 12 characters and at most 72 UTF-8 bytes.
- Login issues a random 256-bit session token. PostgreSQL stores its SHA-256 hash, not the bearer token.
- The browser receives a 24-hour `HttpOnly`, `Secure`, `SameSite=Lax` cookie under `/api/ops`. Vercel proxies those requests to Spring Boot on the same browser origin.
- Writes require a synchronizer CSRF token and an allowed origin when the Origin header is present. Login, registration and sample-session creation require a custom same-origin request header.
- Sign-out deletes the server session and expires the cookie. Changing a password requires the current password, revokes existing sessions and issues a new one.
- Login and registration share a process-local 15-minute limiter: 60 attempts per request IP and 12 per normalized email. The limiter resets on restart and is not a distributed abuse-prevention system. Reverse-proxy addressing can make the IP limit apply to multiple visitors.

There is no forgotten-password recovery, email verification, MFA, membership removal, account deletion or institutional directory integration yet. Do not use this portfolio deployment for sensitive campus records.

## Data lifetime and limits

Account workspaces survive sample-workspace cleanup. Sample sessions last one day; sample workspaces older than seven days are removed when a new sample session starts. Signed-out account data remains in PostgreSQL, subject to the hosting provider's availability and limits.

The application caps accounts at 2,000, requests at 200 per workspace and active invitations at 50 per workspace. These are protective limits, not measured capacity claims. Persistent workspaces need an archive/export and administration workflow before broader use.

Flyway migration V2 adds `accounts` and `invitations`, and links sessions and requests to accounts. It preserves the V1 equipment workflow. The original Express/MongoDB academic portal has a separate authentication implementation and is not connected by this change.

## Checks

`AuthIntegrationTest` covers password hashing, session restoration, invitation expiry and assigned roles, cleanup protection, ownership checks, password-change revocation, CSRF/origin protection, throttling and malformed credentials. `tests/e2e/accounts.spec.js` exercises owner invitation, student request, faculty approval, inventory handoffs, sign-out and login persistence, plus mobile account-page accessibility.

The owner's broad permissions are deliberate. In a real institution, provisioning would be restricted, roles would come from a trusted directory, and separation of duties would be enforced independently of the public signup form.
