## MODIFIED Requirements

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
