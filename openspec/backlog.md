# Backlog

Work not yet proposed as an OpenSpec change. When an item is picked up, it becomes a change under
`openspec/changes/` and is removed from here. Requirement IDs (M8, C7, …) are from the
[Atlas 3.0 design spec](https://claude.ai/artifact/GKHHVKkbSRPtCpya5DZVfZ).

## Proposed after the 3.0 release (2026-11-07)

- **Back from a marker to My markers.** After opening a marker from My markers there is no easy
  way back to the list. Add a `<` before the marker's name in its details, and make Backspace
  (Delete on a Mac) do the same, returning to My markers where the person left it.
- **Signing in confirms your markers.** Treat an owner or editor signing in as confirming their
  active markers, so keeping the Atlas current needs no extra step. To decide: whether every
  sign-in counts or only the first in some period; whether it covers markers a person edits but
  doesn't own; how someone who signs in for one marker avoids confirming others they no longer
  run (for example, a "not current?" prompt in My markers for markers past 12 months); and
  whether reminders and the emailed "still current" link stay as they are for people who never
  sign in.
- **No "Still current" for recently confirmed markers.** Don't offer it on a marker confirmed
  recently. If signing in confirms markers, the button may not be needed at all.

## Phase 3 · Grow (from the design spec)

- **List view (M8, Should).** A sortable list of the sites on screen, beside the map.
- **Share cards and a website badge (Adoption).** After adding or confirming a marker, offer a
  shareable card (map snippet and name) for social media, and a "Find us on the OpenMRS Atlas"
  badge or embed snippet for the implementation's own website.
- **Contact relay form (C7, Should).** Opt-in per marker: visitors write through a form relayed to
  the site contact, whose address is never shown. Off by default, including for migrated markers.
- **Claim an orphaned marker (C9, Should).** A request to admins for approval. 85 markers have no
  owner or editors, and 69 of the 175 people named on active markers have no OpenMRS ID.
- **Nightly world images (X2, Should).** 1080p and 4K, light and dark, at stable URLs for slides.
- **Posts to OpenMRS Talk (X4, Could).** New sites posted automatically.

Already built from this phase: headline stats (M9) and the RSS feed (X3).

## Phase 4 · As demand shows (from the design spec)

- Embeddable map (M10, Could): an iframe for openmrs.org and partner sites.
- Group ownership (O5, Could): a Keycloak group owns a marker.
- Child sites with their own locations (C8, Could). Today a marker's site count covers multi-site
  implementations.

## Cutover and clean-up

- Owner email campaign at the announcement (design spec, gate 2).
- Retire Atlas 2.0, its MySQL database and LDAP; retire the Atlas module and its ping API.
- Remove the `openmrs-atlas.web.app` addresses from the production `atlas` Keycloak client after
  the DNS switch.
- Carbon Design look, starting with Carbon's tokens only (option B).
- Infrastructure and DNS in Terraform.

## Smaller items deferred by earlier changes

- Email when a transfer is offered or accepted.
- Longer sessions (offline tokens, or Keycloak session settings shared with other OpenMRS
  services).
- Bounce and complaint handling beyond Mandrill's rejection list.
- An Atom feed, or feeds filtered by country or type.
