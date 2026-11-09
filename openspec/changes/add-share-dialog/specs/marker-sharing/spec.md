## Purpose
Ways to share a marker from the map: a link, the social networks, the device's own share sheet,
the marker's card as an image, and a badge for an implementation's own website.

## ADDED Requirements

### Requirement: Share from marker details
The details of every public marker, including closed ones, SHALL offer a Share button to every visitor, signed in or not. It SHALL open the Share dialog for that marker. The dialog SHALL show only information published in `atlas.json`.

#### Scenario: Visitor shares a site
- **WHEN** a visitor who isn't signed in opens a marker's details and presses Share
- **THEN** the Share dialog opens, titled with the marker's name

#### Scenario: Closed site
- **WHEN** a visitor opens the details of a closed marker
- **THEN** Share is offered

### Requirement: Share dialog
The Share dialog SHALL offer, in this order: the marker's card as a preview when it has one, Copy link, LinkedIn, Facebook, X and WhatsApp, the device's share sheet where the browser offers one, Website badge and Download image. It SHALL work by keyboard and on phones. Escape or Close SHALL close only the dialog, and focus SHALL return to where it was.

#### Scenario: Closing the dialog
- **WHEN** a visitor opens the Share dialog from a marker's details and presses Escape
- **THEN** the dialog closes, the details stay open, and focus returns to the Share button

#### Scenario: On a phone
- **WHEN** a visitor opens the Share dialog on a 375-pixel-wide screen
- **THEN** every option can be reached without scrolling sideways

#### Scenario: Marker without a card yet
- **WHEN** the dialog opens for a marker whose card hasn't been drawn
- **THEN** no preview is shown, and the other options still work

### Requirement: Copy link
Copy link SHALL copy the marker's permalink, `<site>/marker/<id>`, where `<site>` is the address the visitor is using, and SHALL say that it was copied. Where the browser won't copy, the dialog SHALL show the link selected so the visitor can copy it themselves.

#### Scenario: Copying the link
- **WHEN** a visitor on atlas.openmrs.org presses Copy link for a marker
- **THEN** `https://atlas.openmrs.org/marker/<id>` is on their clipboard and the dialog says "Link copied"

### Requirement: Social networks
LinkedIn, Facebook, X and WhatsApp SHALL be links that open that network's own share page in a new tab, with the permalink and, where the network accepts text, "<name> on the OpenMRS Atlas". The site SHALL load no scripts, images or cookies from those networks.

#### Scenario: Share on LinkedIn
- **WHEN** a visitor presses LinkedIn in the Share dialog
- **THEN** LinkedIn's share page opens in a new tab with the marker's permalink

#### Scenario: Share on WhatsApp
- **WHEN** a visitor presses WhatsApp
- **THEN** WhatsApp opens with a message containing "<name> on the OpenMRS Atlas" and the permalink

#### Scenario: Nothing loaded from the networks
- **WHEN** the Share dialog is open
- **THEN** the page has made no requests to LinkedIn, Facebook, X or WhatsApp

### Requirement: Device share sheet
Where the browser supports the Web Share API, the dialog SHALL offer "More options…", which opens the device's share sheet with the marker's name and permalink. Where it doesn't, the option SHALL NOT be shown. Cancelling the share sheet SHALL NOT show an error.

#### Scenario: Phone with a share sheet
- **WHEN** a visitor on a phone that supports sharing presses "More options…"
- **THEN** the phone's share sheet opens with the permalink

#### Scenario: Desktop without a share sheet
- **WHEN** the browser has no Web Share API
- **THEN** "More options…" is not shown

### Requirement: Download the card
Download image SHALL save the marker's 1200 × 630 card as a PNG named after the marker. When the marker has no card yet, the dialog SHALL say the image isn't ready and to try again in a few minutes.

#### Scenario: Downloading a card
- **WHEN** a visitor presses Download image for "Kampala Rollout"
- **THEN** a PNG of its card is saved with a file name containing "kampala-rollout"

#### Scenario: Card not drawn yet
- **WHEN** a visitor presses Download image for a marker with no card
- **THEN** nothing is saved and the dialog says the image isn't ready yet

### Requirement: Website badge
The dialog SHALL offer an "On the OpenMRS Atlas" badge in a light and a dark version, with a preview of each and a choice between them. It SHALL show an HTML snippet, an `<a>` linking to the marker's permalink around an `<img>` of the chosen badge with alt text, width and height, and a button to copy it. The snippet SHALL contain no script or iframe.

#### Scenario: Copying the badge snippet
- **WHEN** a visitor chooses the dark badge and presses Copy code
- **THEN** the clipboard holds `<a href="<site>/marker/<id>">` around an `<img>` of the dark badge with alt "On the OpenMRS Atlas"

#### Scenario: Snippet is plain HTML
- **WHEN** the snippet is shown for any marker
- **THEN** it contains no `<script>`, no `<iframe>` and no event attributes

### Requirement: Badge files
The site SHALL serve the two badges as SVG files at stable addresses, one for light backgrounds and one for dark. They SHALL be the same for every marker, SHALL draw their text as shapes rather than relying on fonts, and SHALL load nothing else.

#### Scenario: Badge on another website
- **WHEN** an implementation's website shows the light badge's snippet
- **THEN** the badge displays the same in any browser and links to that marker's permalink

### Requirement: Prompt to share after adding or confirming
After a marker is added, or confirmed with "Still current" or "Update", and the result is published and public, the "Saved" notice SHALL include a Share button that opens the Share dialog for that marker. The prompt SHALL NOT block anything, SHALL go away when the notice is dismissed, and SHALL NOT appear after other edits.

#### Scenario: After adding a marker
- **WHEN** a person adds a marker and it is published
- **THEN** the notice says it was saved and offers Share, and the map can be used as normal

#### Scenario: After "Update" in My markers
- **WHEN** an owner presses "Update" beside a marker in My markers
- **THEN** the notice offers Share, and pressing it opens the Share dialog over My markers

#### Scenario: Ordinary edit
- **WHEN** an editor changes a marker's notes and saves
- **THEN** the notice does not offer Share

#### Scenario: Not published yet
- **WHEN** a marker is added but the publish fails
- **THEN** the notice does not offer Share

### Requirement: Share after confirming by email
After a marker is confirmed from a reminder email, the confirmation page SHALL offer a "Share it" link. It SHALL open the map with that marker's details and Share dialog open. The parameter that opens the dialog SHALL then be removed from the address bar, so a copied address doesn't open the dialog.

#### Scenario: Confirmed from an email
- **WHEN** an owner confirms a marker from a reminder email and presses "Share it"
- **THEN** the map opens on that marker with the Share dialog open

#### Scenario: Copying the address afterwards
- **WHEN** the dialog has opened this way and the visitor copies the address bar
- **THEN** the copied address opens the marker without opening the Share dialog
