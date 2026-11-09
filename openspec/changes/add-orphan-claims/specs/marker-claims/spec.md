## Purpose
Lets the people who run a site with no owner on the Atlas ask to become its owner, with an admin
approving each claim in the Atlas.

## ADDED Requirements

### Requirement: Claim a marker with no owner
The details of an active or closed marker with no owner SHALL offer "Claim this site" to a signed-in person who isn't an editor of it. The claim SHALL require a message of 1 to 1,000 characters on how they are connected to the site. Markers with an owner, and hidden or deleted markers, SHALL NOT accept claims.

#### Scenario: Claiming an orphan
- **WHEN** a signed-in person opens a marker with no owner, writes "I lead the EMR team at this clinic" and sends the claim
- **THEN** the claim is saved as pending and the details say the claim is waiting for an admin

#### Scenario: Marker with an owner
- **WHEN** a signed-in person opens a marker that has an owner
- **THEN** "Claim this site" is not offered, and a claim sent for it is refused

#### Scenario: Empty message
- **WHEN** a person sends a claim without a message
- **THEN** the claim is refused and they are asked to say how they are connected to the site

#### Scenario: Editor of an orphan
- **WHEN** an editor of a marker with no owner opens its details
- **THEN** "Claim this site" is offered, since editors can't become owners any other way

### Requirement: Sign-in hint
The details of every public marker SHALL end with "Is this your site? Sign in to update or claim it." for visitors who aren't signed in, with a link that starts sign-in. The hint SHALL be the same on every marker, so it doesn't reveal which markers have no owner.

#### Scenario: Visitor opens a marker
- **WHEN** a visitor who isn't signed in opens any marker's details
- **THEN** the sign-in hint is shown

### Requirement: Claim limits
A person SHALL have at most one pending claim per marker and at most 10 pending claims in all. A further claim SHALL be refused with a message saying why.

#### Scenario: Second claim on the same marker
- **WHEN** a person with a pending claim on a marker opens its details
- **THEN** the details say their claim is waiting for an admin and offer no second claim

#### Scenario: Too many claims
- **WHEN** a person with 10 pending claims sends another
- **THEN** it is refused with a message that they have too many claims waiting

### Requirement: Admins are told about claims
Each new claim SHALL send one email to the notice address, naming the marker, the claimant's OpenMRS ID and their message, with a link to the marker. With no notice address configured, none SHALL be sent. A failed email SHALL be logged and SHALL NOT fail the claim.

#### Scenario: Claim sent
- **WHEN** `asmith` claims "Eldoret Clinic" and a notice address is set
- **THEN** that address gets one email naming "Eldoret Clinic", `asmith` and the message, with a link to the marker

#### Scenario: Mandrill down
- **WHEN** a person claims a marker while Mandrill is unreachable
- **THEN** the claim is saved and the failed email is logged

### Requirement: Admins review claims
Admins SHALL see every pending claim on a marker in its details, each with the claimant's OpenMRS ID, the date and the message, and SHALL be able to approve or decline it. A decline MAY carry a reason of up to 500 characters. Only admins SHALL be able to approve or decline.

#### Scenario: Admin opens a claimed marker
- **WHEN** an admin opens a marker with two pending claims
- **THEN** both are shown with Approve and Decline

#### Scenario: Non-admin tries to approve
- **WHEN** anyone other than an admin sends a request to approve a claim
- **THEN** it is rejected with 403 and nothing changes

### Requirement: Approving a claim
Approving a claim SHALL make the claimant the owner, keep existing editors other than the claimant, and restart `confirmed_at`. Every other pending claim on the marker SHALL be declined with the reason "Another claim for this site was approved." Approving SHALL be refused when the marker already has an owner. Each decision SHALL be recorded in the change log.

#### Scenario: Claim approved
- **WHEN** an admin approves `asmith`'s claim on a marker with no owner and one editor, `bjones`
- **THEN** `asmith` is the owner, `bjones` is still an editor, `confirmed_at` is the current time, and the marker appears in `asmith`'s My markers as owner

#### Scenario: Competing claims
- **WHEN** an admin approves one of two pending claims on a marker
- **THEN** the other is declined with the reason "Another claim for this site was approved."

#### Scenario: Owner set in the sheet meanwhile
- **WHEN** an admin approves a claim on a marker whose owner was set in the sheet after the claim was made
- **THEN** the approval is refused, and the admin can still decline the claim

### Requirement: Owner set while claims are pending
When an admin sets the owner of a marker in the Atlas, its pending claims SHALL be declined with the reason "This site now has an owner." and each claimant SHALL be told as for any decline.

#### Scenario: Admin assigns an owner
- **WHEN** an admin sets the owner of a marker with a pending claim from `asmith` to `jdoe`
- **THEN** `asmith`'s claim is declined with the reason "This site now has an owner."

### Requirement: The claimant is told the decision
When a claim is approved or declined, the claimant SHALL get one email saying so, with the reason for a decline and a link to the marker. The email address SHALL come from Keycloak during the admin's signed-in request, and SHALL NOT be stored or logged. A failed email SHALL be logged and SHALL NOT undo the decision.

#### Scenario: Approved
- **WHEN** an admin approves `asmith`'s claim
- **THEN** `asmith` gets one email saying they now own the marker, with a link to it

#### Scenario: Declined with a reason
- **WHEN** an admin declines a claim with the reason "Please ask your country lead to claim it"
- **THEN** the claimant gets one email saying the claim was declined, with that reason

#### Scenario: No email on file
- **WHEN** the claimant's OpenMRS ID has no email address
- **THEN** the decision is saved and no email is sent

### Requirement: Withdrawing a claim
A claimant SHALL be able to withdraw their own pending claim from My markers or the marker's details. A withdrawn claim SHALL no longer be shown to admins. Nobody else SHALL be able to withdraw it.

#### Scenario: Claimant withdraws
- **WHEN** `asmith` withdraws their pending claim
- **THEN** it is marked withdrawn, admins no longer see it, and `asmith` can claim the marker again

### Requirement: Claims stay private
Claims, including the claimant's OpenMRS ID and message, SHALL never be published. A person SHALL see only their own claims, and admins SHALL see all. Which markers have no owner SHALL be shown only to signed-in people.

#### Scenario: Snapshot
- **WHEN** a marker has a pending claim and the snapshot is published
- **THEN** `atlas.json` contains nothing about the claim or whether the marker has an owner

#### Scenario: Another person's claim
- **WHEN** a signed-in person who isn't an admin opens a marker another person has claimed
- **THEN** the other person's claim is not shown to them
