# Design

## Context

`AccountPicker` searches whenever its value is 3 or more characters, 300 ms after it last changed,
including the value it starts with. It then drops the result whose username equals the typed text
(`found.filter((a) => a.username !== q.toLowerCase())`). Its list opens whenever results exist and
it hasn't been dismissed, and Enter picks the highlighted (first) suggestion. Three fields use it:
the admin's Owner field in `MarkerForm`, and "Add an editor" and "New owner" in
`SharingControls`. Only the Owner field opens already filled.

## Goals / Non-Goals

**Goals:** typing a known ID offers it; an untouched field never opens a list.

**Non-Goals:** changes to the service's search, or ranking beyond the exact match.

## Decisions

**1. Keep the exact match, and move it first.** Replace the filter with a stable sort that puts
the account whose username equals the typed text (lower-cased) first, then the rest in the
service's order. Enter then keeps the typed ID when it exists.

**2. Search only after an edit.** A `touched` flag starts false and becomes true on the first
change the person makes (in `onChange`). The search effect does nothing until it is true. A
parent changing `value` (loading a form, or clearing a field after adding an editor) doesn't set
it. After a pick, the list closes as it does now.

## Risks / Trade-offs

- **[A person who wants to re-pick the current owner has to edit the field first]** → That's the
  intent. Typing one character or deleting one is enough.

## Migration Plan

Ships in 3.3 with the other changes. No data or configuration changes.
