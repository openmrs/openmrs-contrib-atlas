## ADDED Requirements

### Requirement: Deleted files can be restored
Each environment's public bucket SHALL keep deleted and overwritten files for 30 days, so a logo or snapshot deleted by mistake can be restored.

#### Scenario: Logo deleted by mistake
- **WHEN** an admin finds, a week later, that a marker's logo file was deleted
- **THEN** an infra supporter can restore it to the same name, by following the infra README, and the marker shows it again
