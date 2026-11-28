# Backlog

Work not yet proposed as an OpenSpec change. When an item is picked up, it becomes a change under
`openspec/changes/` and is removed from here. Requirement IDs (M8, C7, …) are from the
[Atlas 3.0 design spec](https://claude.ai/artifact/GKHHVKkbSRPtCpya5DZVfZ).

## Phase 3 · Grow (from the design spec)

- **Contact relay form (C7, Should).** Opt-in per marker: visitors write through a form relayed to
  the site contact, whose address is never shown. Off by default, including for migrated markers.
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
- Carbon Design look, starting with Carbon's tokens only (option B).

## Smaller items deferred by earlier changes

- Email when a transfer is offered or accepted.
- Bounce and complaint handling beyond Mandrill's rejection list.
- An Atom feed, or feeds filtered by country or type.
- Find the source of the `MaxListenersExceededWarning` in the service's logs. The service runs with
  `--trace-warnings`, so the next one logs where it came from.
