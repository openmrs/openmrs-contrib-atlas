# Proposal

## Why

People have to sign in again on almost every visit. There are two reasons:

- **Atlas forgets the sign-in when the tab closes.** The site keeps it in the browser's per-tab `sessionStorage`. A new tab, a bookmark or a browser restart starts signed out, even while the Keycloak session is still alive.
- **Keycloak's normal session is short.** Both realms end it after 30 minutes idle or 10 hours at most. Those settings are shared with every OpenMRS site and stay as they are.

Most people edit their markers on their own computer, and for them signing in again each time is friction with no gain. Keycloak already has a standard way to stay signed in on a device, offline sessions. Both realms keep those for 30 days of inactivity, renewed with each use, with no maximum. The `atlas` client already lists `offline_access` as an optional scope in both realms.

## What Changes

- **The sign-in survives new tabs and visits.** The site keeps the sign-in in the browser's `localStorage`, shared by every Atlas tab, and renews it quietly with Keycloak's refresh token when a page opens. This lasts as long as Keycloak's normal session allows. Opening the Atlas after that session has lapsed shows it signed out, with no "session ended" notice; the notice is for a session that ends while a page is open.
- **"Keep me signed in on this device".** A checkbox on the sign-in panel, off by default, asks Keycloak for an offline session. Ticked, the sign-in lasts until it has gone unused for 30 days, or the person signs out, or Keycloak ends it, for example when the account is disabled. Unticked, sign-in behaves as above.
- **Signing out ends a kept sign-in.** Signing out revokes the offline session in Keycloak, not just this browser's copy, and ends the Keycloak session as today.
- **Weighty actions need a recent sign-in.** These need a sign-in within the last 10 minutes, however long the session has lasted:
  - offering a marker to a new owner;
  - anything a person can do only because they are an admin: changing a marker they don't own or edit, setting an owner, editors or status, reviewing claims, sending reminders.

  Otherwise the service answers that a fresh sign-in is needed. The site keeps whatever was typed, sends the person to Keycloak to enter their password again, brings them back to the form, and they submit again. Ordinary edits, confirming and managing one's own editors don't ask.
- **Keycloak stays in charge.**
  - No realm session settings change.
  - Access tokens still last minutes, and every renewal goes through Keycloak, so a disabled account, or someone removed from `atlas-administrators`, stops working at the next renewal.
  - People can see and revoke Atlas's offline access on their Keycloak account page.

### Out of scope

- Changing Keycloak's session settings, or adding a "remember me" to Keycloak's own login page.
- Keeping tokens out of the browser behind a service-side session (a "backend for frontend"). That would mean a confidential client, cookie sign-in and protection against cross-site requests. It can come later if a kept token in `localStorage` proves unacceptable.
- An Atlas-issued session or JWT of its own.
- Signing out other devices, or listing them, from within the Atlas. Keycloak's account page does this.
- Changing what opening the site while signed in does. It already confirms the person's recently confirmed markers (specs/marker-editing, "Signing in keeps recent markers current"). With longer sign-ins, that happens on more visits, as that requirement already says.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-sign-in`:
  - the sign-in panel offers "Keep me signed in on this device";
  - signing in lasts across tabs and visits;
  - a kept sign-in lasts as long as Keycloak's offline session;
  - signing out ends a kept sign-in;
  - weighty actions need a recent sign-in, and the site handles that without losing what was typed.

## Impact

- **Web:**
  - `web/src/auth/oidc.ts`: storage, the `offline_access` scope, `max_age` for a fresh sign-in, and revoking on sign-out;
  - `web/src/auth/session.ts` and `useSession.ts`: a quiet renewal when a page opens, a lapsed sign-in cleared without a notice, sign-out seen across tabs;
  - `SignInPanel.tsx`: the checkbox;
  - the API client: a "sign in again" answer, handled through the path that already keeps forms' contents when a session ends.
- **Service:**
  - `service/src/keycloak.ts` reads `auth_time` into the person;
  - a recent sign-in check in `editor-base.ts` (`find`), `claims.ts` (reviews), the owner, editors and status checks in `markers.ts`, the transfer offer in `people.ts`, and `POST /reminders` in `app.ts`;
  - a new 401 answer, `{"code": "sign-in-again"}`.
- **Shared:** `Person` gains the sign-in time.
- **Docs:** `service/README.md`, "Keycloak": the `atlas` client's `offline_access` scope, and the `basic` scope that puts `auth_time` in access tokens.
- **Keycloak:** no changes. Staging is checked first to confirm that access tokens carry `auth_time`, and that revoking a kept sign-in removes its offline session.
