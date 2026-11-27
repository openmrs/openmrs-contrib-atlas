# Tasks

## 1. Service: the sign-in time and the recent sign-in check

- [x] 1.1 Add `signedInAt?: number` (ms) to `Person` in `shared/src/permissions.ts`. In `service/src/keycloak.ts`, set it from `auth_time` when it is a positive number. The first time a verified token has no `auth_time`, log `{"event":"auth-time-missing"}`, without the token or username. Unit tests: a token with `auth_time` gives `signedInAt`; one without gives none and logs once.
- [x] 1.2 Add `requireRecentSignIn(person, now)` and `RECENT_SIGN_IN_MS = 10 * 60_000` next to the API errors. It throws 401 `{ error: "Please sign in again to do this.", code: "sign-in-again" }`. Unit tests: signed in 9 minutes ago passes, 11 minutes ago throws, no `signedInAt` throws.
- [x] 1.3 Call it where design Decision 6 says, each after the existing 403 checks:
  - in `MarkerEditor.find`, when `roleOn({ ...person, admin: false }, priv)` can't do the action;
  - in `add` and `update` when an admin sets `owner`, `editors` or `status`;
  - claim approve and decline;
  - `people.ts` `offer`;
  - `POST /reminders`.

  API tests for each scenario under specs/user-sign-in, "Weighty actions need a recent sign-in":
  - an owner offering a transfer 3 days after signing in: 401 `sign-in-again`, nothing offered;
  - the same 5 minutes after signing in: the offer is made;
  - an admin editing a marker they don't own, 1 hour in: 401, nothing saved;
  - an admin approving and declining a claim, 1 hour in: 401;
  - an owner editing, confirming and adding an editor, 3 days in: saved;
  - an admin editing their own marker without owner, editors or status, 1 hour in: saved;
  - a non-admin setting `owner`: still 403;
  - `POST /reminders` by an admin 1 hour in: 401.

  Update the test token helper so tokens carry `auth_time`, defaulting to just now, so existing tests are unaffected.

## 2. Web: one sign-in for every tab and visit

- [x] 2.1 In `web/src/auth/oidc.ts`, keep the user in `localStorage` (`userStore`) and the redirect state in `sessionStorage` (`stateStore`). In `session.ts`, read and remove the user key from `localStorage`, and keep `atlas.return` in `sessionStorage`.
- [x] 2.2 Add `clearLapsedSession()` to `session.ts`. When the page opens with a stored user, try to renew it; if Keycloak refuses, remove it without calling the session-ended listeners. In `useSession`, call it before the first `GET /me`. A network failure keeps the sign-in.
- [x] 2.3 Listen for `storage` events on the user key. Removal in another tab goes through `sessionEnded()`; a sign-in in another tab refreshes the session.
- [x] 2.4 In e2e mode, `hasSession()` and `getToken()` read `atlas.e2e.token` from `sessionStorage` and then `localStorage`, and `signIn` writes it to `localStorage`. Existing e2e tests pass unchanged.
- [x] 2.5 Unit tests for `oidc.ts`, with `UserManager` mocked: the user store is `localStorage` and the state store `sessionStorage`; a refused renewal on page open clears quietly; a network error keeps the user. E2E: "New tab" (a second page in the same context is signed in), and "Signing out in another tab".

## 3. Web: Keep me signed in

- [x] 3.1 In `SignInPanel.tsx`, add an unticked "Keep me signed in on this device" checkbox, with the hint from design Decision 4. `onSignIn(keep)` passes the choice to `signIn(returnTo, keep)`, which remembers it under `atlas.keep` and, when ticked, asks for `openid profile offline_access`.
- [x] 3.2 In `startSignOut()`, revoke the refresh token before `signoutRedirect()`, carrying on if revocation fails. Clear `atlas.keep` on sign-out.
- [x] 3.3 Unit tests: the scope with and without keep; revocation before the sign-out redirect, and sign-out still happening when revocation throws; `sessionEndsAt()` returns `undefined` for a refresh token without `exp`. E2E: "Keep me signed in is off by default", and ticking it records `keep`.

## 4. Web: signing in again for weighty actions

- [x] 4.1 In `web/src/lib/api.ts`, carry `code` on `ApiError`, and don't end the session for a 401 whose code is `sign-in-again`.
- [x] 4.2 In the forms that can get it (marker form, transfer, claims review, the admin fields), show "For your safety, please sign in again to do this." with a **Sign in again** button. The button uses the existing keep-the-form sign-in path with `max_age: 0`, asking for `offline_access` again when `atlas.keep` is set. The old refresh token isn't revoked first (design Decision 7). Nothing is resubmitted automatically.
- [x] 4.3 E2E, with the stubbed API answering `sign-in-again`:
  - "Offering a transfer on a long sign-in": the message shows, Sign in again returns to the transfer form with the ID still filled in, and the second submit succeeds;
  - "Admin edits someone else's marker": changes are kept;
  - "Sign-in again is not a lapsed session": the top bar still shows the person, with no session-ended notice.

## 5. Docs and checks

- [x] 5.1 In `service/README.md`, "Keycloak":
  - the `atlas` client needs `offline_access` as an Optional client scope, and the realm's `basic` scope, for `auth_time`;
  - the offline session idle time is what the sign-in panel's "30 days" refers to;
  - weighty actions need a sign-in within 10 minutes.
- [x] 5.2 Run the format check, typecheck, lint, unit tests, the e2e suite and the build.

## 6. Staging

- [ ] 6.1 (manual) In both realms' admin consoles, confirm:
  - the `basic` client scope's `auth_time` mapper adds the claim to access tokens;
  - Realm settings › Tokens › "Revoke Refresh Token" is off.
- [x] 6.2 Push to `main`, update `gode`, and check `/health`.
- [x] 6.3 (manual) On staging, signed in without "keep":
  - a new tab is signed in;
  - closing the browser and coming back within 30 minutes is still signed in;
  - the next day shows "Sign in" without a notice.
- [x] 6.4 (manual) On staging, signed in with "keep":
  - the next day is still signed in without a password;
  - Keycloak's account page lists the Atlas's offline access;
  - offering a transfer asks for the password again and then works, and the account page still lists one offline access for the Atlas, not two;
  - signing out removes the offline access from the account page;
  - revoking it from the account page signs the Atlas out at its next renewal.
- [x] 6.5 (manual) On staging, as an admin signed in for more than 10 minutes: editing someone else's marker and reviewing a claim each ask for the password, keep what was typed, and then work. Editing one's own marker doesn't ask.

## Workflow follow-up

- Archive this change with its specs synced once section 6 passes. It ships to production with 4.1.
