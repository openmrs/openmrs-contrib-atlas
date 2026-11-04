# account-lookup Specification

## Purpose
Lets the Atlas check that an OpenMRS ID exists, help people find the right account, and reach account holders at the email on their OpenMRS ID, while exposing as little of the account directory as possible.

## Requirements

### Requirement: Read-only service access to accounts
The service SHALL read OpenMRS accounts through a Keycloak client of its own that can only view users. Its credentials SHALL be held only by the service. The browser SHALL never call the Keycloak admin API or receive those credentials.

#### Scenario: Credentials stay on the service
- **WHEN** the web app's built files and every API response are inspected
- **THEN** none contain the service client's secret or a token issued to it

### Requirement: Account lookups have a trusted trigger
The service SHALL look up accounts only while handling a request from a signed-in person, or while running the reminder job started by the scheduler or a signed-in admin. A request without a valid sign-in, including any request from an emailed link, SHALL NOT cause an account lookup.

#### Scenario: Anonymous search
- **WHEN** a request without a valid sign-in calls account search
- **THEN** it is refused with 401 and Keycloak is not called

#### Scenario: Emailed link
- **WHEN** someone confirms a marker or unsubscribes from an emailed link
- **THEN** Keycloak is not called

### Requirement: Account search
A signed-in person SHALL be able to search accounts by part of a username or name, with at least 3 characters. Results SHALL hold at most 10 accounts, each with only its username and display name, and SHALL leave out disabled accounts. Searches SHALL be limited to 30 a minute per person.

#### Scenario: Find a colleague
- **WHEN** an owner types "smit" while adding an editor
- **THEN** up to 10 matching accounts are offered, each showing a username and name and no email

#### Scenario: Too short
- **WHEN** a search has fewer than 3 characters
- **THEN** it is refused with 400 and Keycloak is not called

#### Scenario: Too many searches
- **WHEN** a person makes a 31st search within a minute
- **THEN** it is refused with 429

### Requirement: Emails stay inside the service
Account emails SHALL be used only to send Atlas email. They SHALL NOT be returned in any API response, except a person's own email to that person, and SHALL NOT be written to the sheet, the public files or the logs.

#### Scenario: Own email
- **WHEN** a signed-in person opens My markers
- **THEN** it shows the email reminders go to, taken from their own sign-in

#### Scenario: Someone else's email
- **WHEN** an owner views the editors of their marker
- **THEN** usernames are shown and no emails

### Requirement: Keycloak unavailable
When Keycloak cannot be reached, a request that needs an account check SHALL fail with a message to try again, and SHALL change nothing. Requests that need no account check SHALL work as usual.

#### Scenario: Adding an editor while Keycloak is down
- **WHEN** an owner adds an editor while Keycloak is unreachable
- **THEN** the editor is not added and the owner is told to try again shortly
