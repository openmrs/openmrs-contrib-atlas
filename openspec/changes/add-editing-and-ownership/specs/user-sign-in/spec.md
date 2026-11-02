# Spec Delta

## Purpose

Lets people sign in to the Atlas with their OpenMRS account, and lets the service establish who is making each request and whether they are an admin.

## ADDED Requirements

### Requirement: Sign in with OpenMRS Keycloak
People SHALL sign in through OpenMRS Keycloak, with no Atlas-specific account or password. After signing in or out they SHALL return to the view they left, and the page SHALL show who is signed in.

#### Scenario: Signing in from a shared view
- **WHEN** a visitor viewing a filtered map with a marker open chooses "Sign in" and completes sign-in
- **THEN** they return to the same filters, map area and marker, and their OpenMRS ID is shown

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
Every request that reads private data or changes anything SHALL carry a Keycloak token, which the service SHALL verify. The service SHALL reject a token that is missing, expired, wrongly signed, from another issuer, or issued to another client.

#### Scenario: Anonymous edit
- **WHEN** a request to change a marker arrives without a token
- **THEN** it is rejected with 401 and nothing changes

#### Scenario: Token from another client
- **WHEN** a request carries a valid token that Keycloak issued to a different application
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
