# user-sign-in Specification

## Purpose
Lets people sign in to the Atlas with their OpenMRS account, and lets the service establish who is making each request and whether they are an admin.

## Requirements

### Requirement: Sign in with OpenMRS Keycloak
People SHALL sign in through OpenMRS Keycloak, with no Atlas-specific account or password. After signing in or out they SHALL return to the view they left, and the page SHALL show who is signed in.

#### Scenario: Signing in from a shared view
- **WHEN** a visitor viewing a filtered map chooses "Sign in" and completes sign-in
- **THEN** they return to the same filters and map area with My markers open, and their OpenMRS ID is shown

#### Scenario: Signing out
- **WHEN** a signed-in person chooses "Sign out"
- **THEN** they are signed out of the Atlas, the view they were on stays, and no edit controls are shown

#### Scenario: Sign-in cancelled or unavailable
- **WHEN** sign-in fails or Keycloak cannot be reached
- **THEN** the map keeps working and a message says that sign-in is unavailable

### Requirement: Signing in is never needed to view
Everything available to visitors today SHALL stay available without signing in, and sign-in SHALL NOT delay the map's first load.

#### Scenario: Keycloak is down
- **WHEN** a visitor opens the Atlas while Keycloak is unreachable
- **THEN** the map, search, filters and downloads work as normal

### Requirement: Requests are checked by the service
Every request that reads private data or changes anything SHALL carry a Keycloak access token, which the service SHALL verify. The service SHALL reject a token that is missing, expired, wrongly signed, from another issuer, issued to another client, or not an access token.

#### Scenario: Anonymous edit
- **WHEN** a request to change a marker arrives without a token
- **THEN** it is rejected with 401 and nothing changes

#### Scenario: Token from another client
- **WHEN** a request carries a valid token that Keycloak issued to a different application
- **THEN** it is rejected with 401 and nothing changes

#### Scenario: ID token
- **WHEN** a request carries a valid ID token that Keycloak issued to the Atlas client
- **THEN** it is rejected with 401 and nothing changes

### Requirement: Identity comes from the token
A person's identity SHALL be the username in their verified token, compared without regard to case. They SHALL be an admin only if the token lists the group `atlas-administrators`.

#### Scenario: Admin group
- **WHEN** a person in the Keycloak group `atlas-administrators` signs in
- **THEN** the service treats them as an admin on their next request

#### Scenario: Username case
- **WHEN** a marker lists owner `JDoe` and the token's username is `jdoe`
- **THEN** that person is treated as the owner

### Requirement: An expired session keeps unsaved work
When a session ends while someone is filling in a form, the form's contents SHALL survive signing in again.

#### Scenario: Session expires while editing
- **WHEN** a person submits an edit after their session has expired
- **THEN** they are asked to sign in again and return to the form with what they typed still there

#### Scenario: Session ends with the form open
- **WHEN** a session ends while a person has a form open
- **THEN** the form stays open with what they typed, and offers signing in again

### Requirement: The page shows when a session has ended
The page SHALL stop showing a person as signed in as soon as it learns their session has ended: when the service rejects a request, when their token can't be renewed, when they return to the page after their session has lapsed, or when the session's known end time passes with the page open. The Atlas SHALL NOT extend a session beyond Keycloak's settings. A brief network failure SHALL NOT end a session.

#### Scenario: Returning after a while
- **WHEN** a person returns to an open Atlas page after their session has lapsed
- **THEN** the top bar shows "Sign in", edit controls are gone, and a notice says the session has ended

#### Scenario: Request rejected
- **WHEN** the service answers any request with 401
- **THEN** the top bar shows "Sign in" and a notice says the session has ended

#### Scenario: Opening a form after the session has ended
- **WHEN** an edit form can't load because the session has ended
- **THEN** it offers signing in again, shows no empty form, and clicking the map does not place a pin

#### Scenario: Network failure
- **WHEN** a person's token can't be renewed because the network is down
- **THEN** they stay signed in, and the request that needed the token reports an error

### Requirement: Signing in explains itself
Choosing "Sign in" SHALL first show a short panel saying that signing in lets a person add or update their site, with a button that starts sign-in and a "Keep me signed in on this device" checkbox, unticked by default.

#### Scenario: Visitor chooses Sign in
- **WHEN** a visitor chooses "Sign in" in the top bar
- **THEN** a panel says "Sign in to add or update your site", and sign-in starts only when they confirm

#### Scenario: Keep me signed in is off by default
- **WHEN** the sign-in panel opens
- **THEN** "Keep me signed in on this device" is unticked, and a hint says to tick it only on a device the person doesn't share

### Requirement: Signed in across tabs and visits
A sign-in SHALL apply to every Atlas tab in that browser and SHALL last across visits for as long as Keycloak's session allows, renewed without asking the person. Opening the Atlas after that session has lapsed SHALL show it signed out without a notice that a session ended.

#### Scenario: New tab
- **WHEN** a signed-in person opens the Atlas in a new tab
- **THEN** the new tab shows them signed in without signing in again

#### Scenario: Next visit within Keycloak's session
- **WHEN** a person closes the browser and opens the Atlas again 10 minutes later
- **THEN** they are still signed in

#### Scenario: Next visit after Keycloak's session has lapsed
- **WHEN** a person who didn't keep their sign-in opens the Atlas the next day
- **THEN** the top bar shows "Sign in", and no notice says a session ended

#### Scenario: Signing out in another tab
- **WHEN** a person signs out in one tab while another Atlas tab is open
- **THEN** the other tab shows them signed out the next time it is used

### Requirement: Keep me signed in on this device
When a person signs in with "Keep me signed in on this device" ticked, the sign-in SHALL last as long as Keycloak's offline session for the Atlas: until it has gone unused for Keycloak's offline idle time, the person signs out, or Keycloak ends it. Every renewal SHALL go through Keycloak, so a disabled account or a lost admin group takes effect at the next renewal.

#### Scenario: Back after two weeks
- **WHEN** a person who kept their sign-in opens the Atlas two weeks later on the same device
- **THEN** they are signed in without entering a password

#### Scenario: Unused for longer than Keycloak allows
- **WHEN** a person who kept their sign-in hasn't used the Atlas for longer than Keycloak's offline idle time
- **THEN** the Atlas shows them signed out

#### Scenario: Admin group removed
- **WHEN** an admin who kept their sign-in is removed from `atlas-administrators`
- **THEN** within minutes the service no longer treats them as an admin, without them signing in again

#### Scenario: Revoked in Keycloak
- **WHEN** a person revokes the Atlas's offline access on their Keycloak account page
- **THEN** the Atlas on their devices shows them signed out at its next renewal

### Requirement: Signing out ends a kept sign-in
Signing out SHALL end a kept sign-in in Keycloak as well as in the browser, so the device can't renew it afterwards.

#### Scenario: Signing out of a kept sign-in
- **WHEN** a person who kept their sign-in chooses "Sign out"
- **THEN** Keycloak no longer lists an offline session for the Atlas from that sign-in, and opening the Atlas again shows "Sign in"

### Requirement: Weighty actions need a recent sign-in
Offering a marker to a new owner, and any action a person may take only because they are an admin, SHALL need a sign-in within the last 10 minutes. Without one the service SHALL change nothing and answer 401 with the code `sign-in-again`. The site SHALL then send the person to sign in again, with their password, keeping what they typed.

#### Scenario: Offering a transfer on a long sign-in
- **WHEN** an owner who signed in three days ago offers their marker to a new owner
- **THEN** nothing is offered, they are asked to sign in again, and after signing in they return to the transfer form with the new owner's ID still filled in

#### Scenario: Offering a transfer just after signing in
- **WHEN** an owner who signed in five minutes ago offers their marker to a new owner
- **THEN** the offer is made without asking them to sign in again

#### Scenario: Admin edits someone else's marker
- **WHEN** an admin who signed in an hour ago saves a change to a marker they neither own nor edit
- **THEN** nothing is saved, and they are asked to sign in again with their changes kept

#### Scenario: Admin reviews a claim
- **WHEN** an admin who signed in an hour ago approves or declines a claim
- **THEN** nothing changes until they have signed in again

#### Scenario: Ordinary edit on a long sign-in
- **WHEN** an owner who signed in three days ago edits or confirms their own marker, or adds an editor
- **THEN** the change is saved without asking them to sign in again

#### Scenario: Admin edits their own marker
- **WHEN** an admin who signed in an hour ago edits a marker they own, without changing its owner, editors or status
- **THEN** the change is saved without asking them to sign in again

#### Scenario: Sign-in again is not a lapsed session
- **WHEN** the service answers `sign-in-again`
- **THEN** the person stays signed in, and the page doesn't say their session has ended
