## ADDED Requirements

### Requirement: Email is sent before the response
An email that follows a person's action (the new-marker notice, the claim notice and claim decisions) SHALL be sent, or SHALL fail, before the service answers that action's request, so an idle service never leaves it unsent. The wait SHALL be bounded by the email and account lookup timeouts. A failure SHALL be logged and SHALL NOT fail the action.

#### Scenario: Notice for a new marker
- **WHEN** a person adds a marker and a notice address is set
- **THEN** the notice has been handed to Mandrill, or its failure logged, by the time the person sees the marker saved

#### Scenario: Mandrill slow
- **WHEN** an admin declines a claim while Mandrill takes longer than its timeout
- **THEN** the decline is saved, the admin gets an answer once the timeout passes, and the failed email is logged
