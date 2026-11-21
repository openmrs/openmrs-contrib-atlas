# Design

## Context

- `MarkerEditor` (in `edits.ts`) holds a store, a clock and optional account access.
  - **Private helpers** used by every subject: `tabs()`, `find()`, `writeMarker()`,
    `writePrivate()`, `log()`, `result()`, `requireAccounts()` and `clearOffers()`.
  - **Public methods**, in four groups:
    - markers: `me`, `read`, `add`, `change`, `confirm`, `confirmRecent`, `close`, `reopen`,
      `remove`, `setReminders`, `viewForLink`
    - editors and transfers: `addEditor`, `removeEditor`, `offer`, `cancelOffer`, `accept`,
      `decline`
    - claims: `claim`, `withdrawClaim`, `approveClaim`, `declineClaim`, plus private helpers
    - shared at the top: `ApiError`, `Tabs`, `EditStore`, `parseChangeBody` and the constants
- **Callers:** `api.ts`, `reminder-links.ts`, `app.ts` and the service tests import from
  `./edits.ts`.
- `reliable-writes` and `limit-untrusted-input` change `add`, `change` and `confirmRecent` first.
  This refactor moves the code as it is after them.

## Goals / Non-Goals

**Goals:**
- Files of a few hundred lines, each about one subject.
- One copy of each shared helper.
- Identical behaviour, proven by the existing tests.

**Non-Goals:** new abstractions, a different public API, or changes to any other workspace.

## Decisions

**1. A folder, with an `index.ts` re-exporting today's names**, so imports of `./edits.ts`
become `./edits/index.ts` and nothing else changes:

| File | Holds |
|---|---|
| `edits/core.ts` | `ApiError`, `Tabs`, `EditStore` and its types, the error helpers, `parseChangeBody` and the constants |
| `edits/editor-base.ts` | an `EditorBase` class with the shared private helpers |
| `edits/markers.ts` | marker edits |
| `edits/people.ts` | editors and transfers |
| `edits/claims.ts` | claims |

**2. Composition, not inheritance between subjects.** `MarkerEditor` extends `EditorBase`. It
creates `People` and `Claims` objects (each also an `EditorBase` over the same store and clock),
and delegates to them with one-line methods. The callers' API stays exactly as it is. Claims call
`change` for an owner set by an admin, and `change` declines claims, so the two refer to each
other through the editor rather than by importing each other.
_Alternative:_ mixins or free functions taking the editor. Rejected as less familiar to
volunteers than a few small classes.

**3. `escapeHtml()` escapes `& < > " '`.** The five copies are used in HTML text and attribute
values. Escaping `'` as well is safe everywhere, and it matters for single-quoted attributes. Tests
that compare rendered HTML may need `&#39;` where a `'` appears. That is the one visible
difference, and it doesn't change how the HTML renders.

**4. `publishSafely(publish)`** lives in `service/src/publishing.ts` (new). It runs the publish,
logs a failure as `publish-failed`, and returns whether it published. That is the part the three
places repeat; what each does around it differs. `api.ts`'s `write()` and `confirm-recent`, and
`reminder-links.ts`'s confirm, use it. (Planned as a `publishAfter()` that also ran the write,
but the writes differ too much for one wrapper to stay simple.)

## Risks / Trade-offs

- **[A move drops or changes behaviour]** → The service tests (260+) run before and after with only
  import changes. Diff each moved method against the original.
- **[Merge conflicts with the earlier changes]** → This goes last, after those are applied.

## Migration Plan

No deploy steps. It ships with the rest of the release, and staging confirms nothing changed.
