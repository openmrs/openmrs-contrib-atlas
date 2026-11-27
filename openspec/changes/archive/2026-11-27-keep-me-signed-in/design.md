# Design

## Context

See proposal.md, "Why".

**The browser** (`web/src/auth/`):
- `oidc-client-ts` runs Authorization Code with PKCE on the public client `atlas`, with `scope: "openid profile"`.
- It keeps the signed-in user (access, refresh and ID tokens) in `sessionStorage` under `oidc.user:<issuer>:<client>`, with `automaticSilentRenew: false`.
- `accessToken()` renews an expired access token with `signinSilent()`, which uses the refresh token.
- `hasSession()` reads that key, and `sessionEnded()` removes it and tells the page.
- `sessionEndsAt()` reads the refresh token's `exp` to show the end of the session.
- The library loads only when a session exists or someone signs in, so visitors' first load stays light.

**The service:**
- `keycloak.ts` verifies each access token (issuer, signature, `azp: atlas`, `typ: Bearer`) and builds a `Person` from `preferred_username`, `groups` and `email`.
- Permissions come from `roleOn(person, privateRow)` and `can(role, action)` in `shared/src/permissions.ts`. `roleOn` returns `admin` for any admin, before looking at ownership.
- Marker actions go through `MarkerEditor.find(tabs, person, id, action)`.
- Admin-only checks outside `find`:
  - `owner` and `editors` in `add` and `update`, and `status` in `update` (`markers.ts`);
  - claim reviews (`claims.ts`);
  - `POST /reminders` (`app.ts`).

**Keycloak**, the same in both realms:
- the normal session ends after 30 minutes idle or 10 hours at most;
- the offline session ends after 30 days idle, with no maximum;
- `offline_access` is an Optional client scope on `atlas`;
- the realm offers the `basic` scope, whose mapper puts `auth_time` in access tokens.

## Goals / Non-Goals

**Goals:**

- A sign-in survives new tabs and visits for as long as Keycloak allows, and, when the person asks, for as long as an offline session allows.
- Keycloak stays the authority: it renews every token, its revocation and account changes take effect, and nothing Atlas issues stands in for it.
- The few actions that could do real harm in the wrong hands need a fresh sign-in, without losing what was typed.
- No change for visitors, and nothing extra loaded before someone signs in.

**Non-Goals:**

- A service-side session or cookie sign-in.
- Changing Keycloak, or the `atlas` client's settings.
- Managing a person's other devices.

## Decisions

### 1. `localStorage` for every sign-in

`userStore` becomes `new WebStorageStateStore({ store: window.localStorage })`. `hasSession()` and `sessionEnded()` use the same storage.

The sign-in and return state that `oidc-client-ts` keeps during a redirect (`stateStore`) stays in `sessionStorage`, and so does `atlas.return`. They belong to the tab that started the sign-in.

Kept and unkept sign-ins share the same storage; they differ only in Keycloak's session. That keeps one code path. An unkept sign-in left in `localStorage` is useless once its Keycloak session ends: the refresh token stops working, and the page clears it.

**Alternative considered:** `localStorage` only for kept sign-ins. Then a new tab would still start signed out without "keep", which is what people complain about. Rejected.

### 2. Renewing when a page opens, quietly

When the page opens with a stored user:
- if its access token has expired, `accessToken()` renews it as today;
- if renewal is refused, which means Keycloak has ended the session, the page clears the stored user **without** calling the listeners that show "your session has ended". The new `clearLapsedSession()` does that.

The notice stays for sessions that end while a page is open, as today (specs/user-sign-in, "The page shows when a session has ended"). `useSession` already makes the first call (`GET /me`) only when `hasSession()` says so; the quiet clearing goes right before it.

A network failure still leaves the person signed in, as today.

### 3. Seeing sign-in and sign-out from other tabs

A `storage` event for the user key tells other tabs that the sign-in changed:
- **removed:** the tab goes through `sessionEnded()`, which shows "Sign in";
- **added** (signed in elsewhere): the tab reloads the session quietly through `useSession`'s `refresh`.

Renewals in two tabs at once are harmless, as long as Keycloak's "Revoke Refresh Token" setting stays off, which is its default: a refresh token isn't used up by being used. Task 6.1 confirms the setting in both realms. If it were on, the second tab's renewal would fail and that tab would show "Sign in"; that would be annoying, but safe.

### 4. "Keep me signed in" asks for `offline_access`

`SignInPanel` gets the checkbox, and `signIn(returnTo, keep)` passes the choice on:
- ticked: `signinRedirect({ scope: "openid profile offline_access" })`;
- unticked: the default scope.

The choice is remembered under `atlas.keep` in `localStorage`, so a later fresh sign-in (Decision 7) asks for the same thing.

Keycloak returns an offline refresh token: `typ: Offline`, with no `exp` or one far off. `sessionEndsAt()` already returns `undefined` for a token without `exp`, so no end time is shown. When `exp` is there, it is the 30-day idle time, which moves on with each renewal.

`accessToken()` and the 401 handling don't change.

**Hint text** under the checkbox: "Only on a device you don't share. You'll stay signed in until you sign out or don't visit for 30 days." The 30 days is Keycloak's setting, so it's written in the text, not computed from it.

### 5. Signing out revokes first

`startSignOut()` first calls `manager.revokeTokens(["refresh_token"])`, which posts to Keycloak's revocation endpoint as the public client. For an offline token, that removes the offline session for this sign-in. For a normal one it's harmless. Then `signoutRedirect()` ends the normal session as today.

If revocation fails, for example on a network error, sign-out goes ahead anyway and the stored user is removed. The person is told nothing extra. An orphaned offline session expires after 30 days unused, and it shows on the Keycloak account page.

### 6. The recent sign-in check in the service

- **The sign-in time:** `keycloakVerifier` reads `auth_time` (seconds) into `Person.signedInAt` (ms). It's absent when the token has none.
- **The check:** a new `requireRecentSignIn(person, now)` throws `ApiError(401, { error: "Please sign in again to do this.", code: "sign-in-again" })` unless `signedInAt` is within `RECENT_SIGN_IN_MS = 10 * 60_000`. A token without `auth_time` counts as not recent. That fails closed, so the first staging test must confirm tokens carry it (task 6.1).
- **Where it's called:**
  - in `find`, after the existing permission check, when the person's role **without** admin rights (`roleOn({ ...person, admin: false }, priv)`) doesn't allow the action. That covers an admin acting on someone else's marker, including restoring a deleted one;
  - in `add` and `update`, when `owner`, `editors` or `status` is set by an admin;
  - in `claims.ts`, approving and declining;
  - in `people.ts` `offer`, for everyone: an owner offering a transfer;
  - in `app.ts` `POST /reminders`.
- **Not called:** for cancelling one's own offer, accepting or declining an offer made to you, editing, confirming, closing, managing editors, or claiming. Reading private data doesn't need a fresh sign-in either.
- **Order:** the check comes after the 403 checks, so someone without rights still gets 403, not a request to sign in again.

### 7. The site's answer to `sign-in-again`

`api()` throws an `ApiError` carrying `code`. Today every 401 ends the session; now a 401 with `code: "sign-in-again"` doesn't. Instead:
- The form shows "For your safety, please sign in again to do this," with a **Sign in again** button.
- The button uses the path that already keeps a form's contents across sign-in (specs/user-sign-in, "An expired session keeps unsaved work"), with `max_age: 0` added to the redirect. That makes Keycloak ask for the password even if its own session is alive. It also asks for `offline_access` again if `atlas.keep` is set.
- Back on the page, the form reopens with what was typed, and the person submits again. The site never resubmits by itself, because a transfer or an admin action should be a deliberate second click.

After the fresh sign-in, the stored user is replaced. The old refresh token is **not** revoked first. Keycloak re-authenticates the person's existing session, so there's nothing extra to clean up, and revoking first would sign out anyone who abandoned the password prompt. (Changed during implementation; task 6.4 checks that Keycloak's account page shows no extra offline session afterwards.)

### 8. End-to-end tests

Tests use `config.e2e` with a fake token in `sessionStorage` (`atlas.e2e.token`). They are extended so that:
- `hasSession()` and `getToken()` read `atlas.e2e.token` from `localStorage` too;
- `signIn` writes it to `localStorage`, recording `keep` as `atlas.e2e.keep`.

Existing tests that seed `sessionStorage` keep working. New tests open a second page in the same browser context to check that the sign-in carries over to a new tab. The stubbed API returns `sign-in-again` to exercise Decision 7.

The real `oidc-client-ts` behaviour is checked by unit tests with the library's `UserManager` mocked: the store, the scope, `max_age`, revoking before sign-out, and quiet clearing. Then it's checked by hand on staging.

## Risks / Trade-offs

- **A kept token sits in `localStorage` for up to 30 days unused, longer if used.** A script injected into the Atlas could read it. Mitigations:
  - the content security policy allows only the site's own scripts, with no inline code and no `eval`;
  - keeping is opt-in, with a hint to do it only on unshared devices;
  - people can revoke it on Keycloak's account page.

  If that proves too weak, the "backend for frontend" in proposal.md's out-of-scope list is the next step.
- **An unkept sign-in now outlives its tab.** On a shared computer, someone who closes the tab without signing out stays signed in for up to Keycloak's 30 minutes idle (10 hours if used). Before, closing the tab was enough. That's the same as most sites that use Keycloak, and "Sign out" still ends it at once.
- **`auth_time` may be missing from access tokens** if a realm's `basic` scope mapper were turned off. Then every weighty action would ask for a fresh sign-in, and none would ever succeed. Task 6.1 checks for it on staging before release. The service logs `auth-time-missing`, without the token or username, the first time it sees such a token.
- **More automatic confirmations.** Opening the site already signed in confirms recently confirmed markers. With kept sign-ins that will happen on more visits. The rule doesn't change: only markers confirmed in the last 12 months, at most once a day.
- **Keycloak changes.** If an admin shortens the offline idle time or turns on a maximum, kept sign-ins get shorter, and the hint's "30 days" becomes wrong. The hint is in one place, and service/README.md says where the number comes from.
