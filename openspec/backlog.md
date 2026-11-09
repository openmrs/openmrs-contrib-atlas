# Backlog

Work not yet proposed as an OpenSpec change. When an item is picked up, it becomes a change under
`openspec/changes/` and is removed from here. Requirement IDs (M8, C7, …) are from the
[Atlas 3.0 design spec](https://claude.ai/artifact/GKHHVKkbSRPtCpya5DZVfZ).

## Before the announcement

Agreed 2026-11-07, in this order: `simplify-confirming` (done 2026-11-08), then the list view (done 2026-11-08),
then share cards and the website badge (done 2026-11-08), then orphan claims.

## Phase 3 · Grow (from the design spec)

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
