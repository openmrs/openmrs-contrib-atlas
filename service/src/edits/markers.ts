import { randomUUID } from "node:crypto";
import {
  EDITABLE_FIELDS,
  MARKER_STATUSES,
  can,
  canonicalFields,
  checkLimits,
  checkMarkerRow,
  isUsername,
  needsConfirming,
  normaliseUsername,
  roleOn,
  text,
  toIsoDate,
  validateMarkers,
  type Cell,
  type Person,
  type Role,
} from "@openmrs-atlas/shared";
import type { Accounts } from "../accounts.ts";
import { Claims } from "./claims.ts";
import {
  ApiError,
  NOW_OWNED,
  checkEditors,
  cleanFields,
  forbidden,
  invalidUsername,
  requireRecentSignIn,
  type ChangeBody,
  type ClaimDecision,
  type EditStore,
  type MarkerResult,
  type Offer,
} from "./core.ts";
import { EditorBase } from "./editor-base.ts";
import { People } from "./people.ts";

/**
 * Every change to a marker, and the one entry point for callers: editors, transfers and claims
 * are delegated to their own classes. Each method reads the sheet afresh and must run inside the write
 * queue. Permissions are checked here, never in the browser. See specs/marker-editing and
 * specs/marker-ownership.
 */
export class MarkerEditor extends EditorBase {
  private people: People;
  private claimDesk: Claims;

  /**
   * Without `accounts`, OpenMRS IDs are accepted unchecked (specs/account-lookup). With
   * `logoPrefix`, a `logo_url` set through the Atlas must start with it (specs/marker-editing).
   */
  constructor(
    store: EditStore,
    now: () => Date,
    accounts?: Accounts,
    options: { logoPrefix?: string } = {},
  ) {
    super(store, now, accounts, options);
    this.people = new People(store, now, accounts, options);
    this.claimDesk = new Claims(store, now, accounts, options);
  }

  // Editors and transfers (people.ts).
  addEditor = (person: Person, id: string, username: string) =>
    this.people.addEditor(person, id, username);
  removeEditor = (person: Person, id: string, username: string) =>
    this.people.removeEditor(person, id, username);
  offer = (person: Person, id: string, username: string) => this.people.offer(person, id, username);
  cancelOffer = (person: Person, id: string) => this.people.cancelOffer(person, id);
  accept = (person: Person, id: string): Promise<MarkerResult> => this.people.accept(person, id);
  decline = (person: Person, id: string) => this.people.decline(person, id);

  // Claims (claims.ts).
  claim = (person: Person, id: string, message: unknown) =>
    this.claimDesk.claim(person, id, message);
  withdrawClaim = (person: Person, id: string, claimId: string) =>
    this.claimDesk.withdrawClaim(person, id, claimId);
  approveClaim = (
    person: Person,
    id: string,
    claimId: string,
  ): Promise<MarkerResult & { decisions: ClaimDecision[] }> =>
    this.claimDesk.approveClaim(person, id, claimId);
  declineClaim = (
    person: Person,
    id: string,
    claimId: string,
    reason: unknown,
  ): Promise<ClaimDecision> => this.claimDesk.declineClaim(person, id, claimId, reason);

  /** The signed-in person: their markers and the offers waiting for them. */
  async me(person: Person) {
    const tabs = await this.tabs();
    const { problems } = validateMarkers(tabs.values.markers, tabs.lookups);
    const markers: {
      id: string;
      name: string;
      role: Role;
      status: string;
      confirmed_at: string;
      problems?: string[];
    }[] = [];
    for (const marker of tabs.markers) {
      const id = text(marker.cells.id);
      const status = text(marker.cells.status);
      if (!id || status === "deleted") continue;
      const priv = tabs.privateOf(id);
      const role = roleOn({ ...person, admin: false }, priv);
      if (!role) continue;
      const reasons = problems.find((p) => p.row === marker.row)?.reasons;
      markers.push({
        id,
        name: text(marker.cells.name),
        role,
        status,
        confirmed_at: toIsoDate(marker.cells.confirmed_at) ?? "",
        ...(reasons ? { problems: reasons } : {}),
      });
    }
    const offers = [...new Set(tabs.offers.map((o) => o.marker_id))]
      .map((id) => this.openOffer(tabs, id))
      .filter((o): o is Offer => o !== undefined && normaliseUsername(o.to) === person.username)
      .map((o) => ({
        marker_id: o.marker_id,
        name: text(tabs.marker(o.marker_id)?.cells.name),
        from: o.from,
        expires_at: o.expires_at,
      }));
    return {
      username: person.username,
      admin: person.admin,
      // The person's own email, from their own token: where their reminders go.
      email: person.email ?? "",
      reminders: !tabs.unsubscribed.some((u) => u.username === person.username),
      markers,
      offers,
      claimable: this.claimDesk.claimable(tabs, person),
      claims: tabs
        .pendingClaims()
        .filter((c) => c.username === person.username)
        .map((c) => ({
          id: c.id,
          marker_id: c.marker_id,
          name: text(tabs.marker(c.marker_id)?.cells.name),
          created_at: c.created_at,
        })),
      // Every pending claim, with its message, for admins only (specs/marker-claims).
      ...(person.admin
        ? {
            review: tabs.pendingClaims().map((c) => ({
              id: c.id,
              marker_id: c.marker_id,
              name: text(tabs.marker(c.marker_id)?.cells.name),
              username: c.username,
              message: c.message,
              created_at: c.created_at,
            })),
          }
        : {}),
    };
  }

  /** The form's starting values. Private values only for those entitled to them. */
  async read(person: Person, id: string) {
    const tabs = await this.tabs();
    const { marker, priv, role } = this.find(tabs, person, id, "edit", { reading: true });
    const fields = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, marker.cells[f] ?? ""]));
    const { problems } = validateMarkers(tabs.values.markers, tabs.lookups);
    return {
      id,
      role,
      version: text(marker.cells.updated_at),
      status: text(marker.cells.status),
      fields,
      problems: problems.find((p) => p.row === marker.row)?.reasons ?? [],
      ...(can(role, "contact")
        ? {
            contact: {
              contact_name: text(priv?.cells.contact_name),
              contact_email: text(priv?.cells.contact_email),
            },
            owner: priv?.owner ?? "",
            editors: priv?.editors ?? [],
            offer_to: this.openOffer(tabs, id)?.to,
          }
        : {}),
    };
  }

  async add(person: Person, body: ChangeBody): Promise<{ id: string } & MarkerResult> {
    if ((body.owner !== undefined || body.editors !== undefined) && !person.admin) {
      throw forbidden();
    }
    if (body.status !== undefined || body.version !== undefined) {
      throw new ApiError(400, { error: "That request is not valid." });
    }
    // Setting a new marker's owner or editors is admin-only (specs/user-sign-in).
    if (body.owner !== undefined || body.editors !== undefined) {
      requireRecentSignIn(person, this.now());
    }
    const tabs = await this.tabs();
    const id = randomUUID();
    const stamp = this.stamp();
    const fields = canonicalFields(cleanFields(body.fields ?? {}), tabs.lookups);
    const contact = body.contact ?? {};
    const cells: Record<string, Cell> = {
      ...fields,
      id,
      created_at: stamp,
      updated_at: stamp,
      confirmed_at: stamp,
      status: "active",
    };
    const errors = [
      ...checkLimits({ ...fields, ...contact }, tabs.lookups),
      ...this.checkLogo(fields),
      ...checkMarkerRow(cells, tabs.lookups).errors,
    ];
    if (errors.length > 0) throw new ApiError(422, { error: "Please check the form.", errors });

    const owner = normaliseUsername(body.owner ?? person.username);
    const editors = checkEditors(body.editors ?? []);
    if (!isUsername(owner)) throw invalidUsername("owner");
    if (owner !== person.username) await this.requireAccounts([owner], "owner");
    await this.requireAccounts(editors, "editors");
    // The private row (owner) first: if the second write fails, what's left is an unpublished
    // private row, never a published marker with no owner that anyone could claim.
    await this.writePrivate(tabs, id, { owner, editors: editors.join(","), ...contact });
    await this.store.appendRow(
      "markers",
      tabs.header.markers.map((column) => cells[column] ?? ""),
    );
    await this.log(person, id, "add", [
      ...Object.keys(fields),
      { field: "owner", from: "", to: owner },
    ]);
    return { id, ...this.result(tabs, cells, true) };
  }

  async change(
    person: Person,
    id: string,
    body: ChangeBody,
  ): Promise<MarkerResult & { decisions?: ClaimDecision[] }> {
    const tabs = await this.tabs();
    const { marker, priv, role } = this.find(tabs, person, id, "edit");
    if (body.contact && !can(role, "contact")) throw forbidden();
    if ((body.owner !== undefined || body.editors !== undefined) && !can(role, "set-owner")) {
      throw forbidden();
    }
    if (body.status !== undefined && !can(role, "set-status")) throw forbidden();
    // Owner, editors and status are admin-only fields (specs/user-sign-in).
    if (body.owner !== undefined || body.editors !== undefined || body.status !== undefined) {
      requireRecentSignIn(person, this.now());
    }
    if (body.version !== text(marker.cells.updated_at)) {
      throw new ApiError(409, { error: "This marker has changed since you opened it." });
    }
    if (
      body.status !== undefined &&
      !(MARKER_STATUSES as readonly string[]).includes(body.status)
    ) {
      throw new ApiError(422, {
        error: "Please check the form.",
        errors: [{ field: "status", reason: `unknown status: ${body.status}` }],
      });
    }

    const fields = canonicalFields(cleanFields(body.fields ?? {}), tabs.lookups);
    const changed = Object.fromEntries(
      Object.entries(fields).filter(([f, value]) => text(value) !== text(marker.cells[f])),
    );
    const contact = Object.fromEntries(
      Object.entries(body.contact ?? {}).filter(
        ([f, value]) => text(value) !== text(priv?.cells[f]),
      ),
    );
    const stamp = this.stamp();
    const status = body.status ?? text(marker.cells.status);
    const statusChanged = status !== text(marker.cells.status);
    // Hiding or closing a marker says nothing about whether its details are current.
    const restarts = !statusChanged || status === "active";
    const rowChanges: Record<string, Cell> = {
      ...changed,
      updated_at: stamp,
      ...(restarts ? { confirmed_at: stamp } : {}),
      ...(statusChanged ? { status } : {}),
    };
    const merged = { ...marker.cells, ...rowChanges };
    const errors = [
      ...checkLimits({ ...changed, ...contact }, tabs.lookups),
      ...this.checkLogo(changed),
      ...checkMarkerRow(merged, tabs.lookups).errors,
    ];
    if (errors.length > 0) throw new ApiError(422, { error: "Please check the form.", errors });

    const log: unknown[] = [...Object.keys(changed), ...Object.keys(contact)];
    if (statusChanged) log.push("status");
    const privateChanges: Record<string, Cell> = { ...contact };
    let ownerChanged = false;
    if (body.owner !== undefined) {
      const owner = normaliseUsername(body.owner);
      if (owner && !isUsername(owner)) throw invalidUsername("owner");
      if (owner !== normaliseUsername(priv?.owner ?? "")) {
        if (owner) await this.requireAccounts([owner], "owner");
        privateChanges.owner = owner;
        log.push({ field: "owner", from: priv?.owner ?? "", to: owner });
        ownerChanged = true;
      }
    }
    if (body.editors !== undefined) {
      const added = checkEditors(body.editors);
      const already = new Set((priv?.editors ?? []).map(normaliseUsername));
      await this.requireAccounts(
        added.filter((e) => !already.has(e)),
        "editors",
      );
      const editors = added.join(",");
      const before = (priv?.editors ?? []).join(",");
      if (editors !== before) {
        privateChanges.editors = editors;
        log.push({ field: "editors", from: before, to: editors });
      }
    }
    if (ownerChanged) await this.clearOffers(tabs, id);
    await this.save(tabs, marker, rowChanges, {
      privateCells: privateChanges,
      log: { person, action: "edit", fields: log },
    });
    // An owner set by an admin answers any pending claims (specs/marker-claims).
    const decisions =
      ownerChanged && privateChanges.owner
        ? await this.claimDesk.declineAll(tabs, person, id, tabs.pendingClaims(id), NOW_OWNED)
        : [];
    return {
      ...this.result(tabs, merged, true),
      ...(decisions.length > 0 ? { decisions } : {}),
    };
  }

  async confirm(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "confirm");
    if (text(marker.cells.status) === "closed") {
      throw new ApiError(409, { error: "This site is closed. Reopen it instead." });
    }
    return this.restartClock(tabs, marker, {
      log: { person, action: "confirm", fields: ["confirmed_at"] },
    });
  }

  /**
   * A signed-in session started: confirm the person's active markers that were confirmed less
   * than 12 months ago (and more than a day ago, so reloads write nothing). Older markers wait
   * for a deliberate "Still current", so a sign-in for one site can't revive an ended one.
   * Admin rights alone don't make a marker eligible.
   */
  async confirmRecent(person: Person): Promise<{ confirmed: string[]; publish: boolean }> {
    const tabs = await this.tabs();
    const now = this.now();
    const dayAgo = now.getTime() - 86_400_000;
    const due = tabs.markers.filter((marker) => {
      const id = text(marker.cells.id);
      if (!id || text(marker.cells.status) !== "active") return false;
      if (!roleOn({ ...person, admin: false }, tabs.privateOf(id))) return false;
      const confirmed = toIsoDate(marker.cells.confirmed_at);
      if (!confirmed || needsConfirming(confirmed, now)) return false;
      return new Date(confirmed).getTime() < dayAgo;
    });
    if (due.length === 0) return { confirmed: [], publish: false };

    const stamp = this.stamp();
    const header = tabs.header.markers;
    await this.store.updateCells(
      due.flatMap((marker) =>
        (["updated_at", "confirmed_at"] as const).map((field) => ({
          tab: "markers" as const,
          row: marker.row,
          column: header.indexOf(field),
          value: stamp,
        })),
      ),
    );
    // Logged right after writing, so a failure below can't leave confirmations unrecorded.
    const confirmed = due.map((marker) => text(marker.cells.id));
    await this.store.appendRows(
      "changes",
      confirmed.map((id) => [
        stamp,
        person.username,
        id,
        "confirm-on-sign-in",
        JSON.stringify(["confirmed_at"]),
      ]),
    );
    // Check no one moved rows in the sheet between the read and the write, with one read
    // however many markers there are. Version history recovers a moved row; this only reports it.
    try {
      const ids = await this.store.readColumn("markers", header.indexOf("id"));
      for (const marker of due) {
        const id = text(marker.cells.id);
        if (text(ids[marker.row - 1]) !== id) {
          console.error(JSON.stringify({ event: "row-moved", marker: id, row: marker.row }));
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({ event: "confirm-check-failed", message: (err as Error).message }),
      );
    }
    return { confirmed, publish: true };
  }

  /** The implementation has ended. It stays on the map, and says nothing about freshness. */
  async close(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "close");
    if (text(marker.cells.status) !== "active") {
      throw new ApiError(409, { error: "Only an active site can be closed." });
    }
    const changes = { status: "closed", updated_at: this.stamp() };
    await this.save(tabs, marker, changes, {
      log: { person, action: "close", fields: ["status"] },
    });
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }

  async reopen(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "close");
    if (text(marker.cells.status) !== "closed") {
      throw new ApiError(409, { error: "Only a closed site can be reopened." });
    }
    const stamp = this.stamp();
    const changes = { status: "active", updated_at: stamp, confirmed_at: stamp };
    await this.save(tabs, marker, changes, {
      log: { person, action: "reopen", fields: ["status", "confirmed_at"] },
    });
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }

  /** Keeps the row, so an admin can restore the marker by changing its status. */
  async remove(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "delete");
    const changes = { status: "deleted", updated_at: this.stamp() };
    await this.save(tabs, marker, changes, {
      log: { person, action: "delete", fields: ["status"] },
    });
    await this.clearOffers(tabs, id);
    return { ...this.result(tabs, { ...marker.cells, ...changes }, true), marker: null };
  }

  /** Turns a person's reminders on or off. Takes a username so emailed links can use it. */
  async setReminders(username: string, on: boolean) {
    const tabs = await this.tabs();
    const who = normaliseUsername(username);
    const rows = tabs.unsubscribed.filter((u) => u.username === who);
    if (on) {
      for (const { row } of rows) await this.store.clearRow("unsubscribed", row);
    } else if (rows.length === 0) {
      await this.store.appendRow("unsubscribed", [who, this.stamp()]);
    }
    return { reminders: on };
  }

  /**
   * "Still current" from an emailed link, already checked for signature and expiry. The link
   * names the `confirmed_at` it was sent for, so it works once and dies as soon as the marker
   * is confirmed any other way. See specs/reminder-emails.
   */
  async confirmFromLink(
    id: string,
    sentFor: string,
    username: string,
  ): Promise<
    | { ok: true; result: MarkerResult }
    | { ok: false; reason: "gone" | "inactive" | "confirmed"; confirmed_at?: string }
  > {
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    if (!marker || text(marker.cells.status) === "deleted") return { ok: false, reason: "gone" };
    const confirmedAt = toIsoDate(marker.cells.confirmed_at) ?? "";
    if (text(marker.cells.status) !== "active") return { ok: false, reason: "inactive" };
    if (confirmedAt !== sentFor) {
      return { ok: false, reason: "confirmed", confirmed_at: confirmedAt };
    }
    const result = await this.restartClock(tabs, marker, {
      log: {
        person: `reminder-link:${normaliseUsername(username)}`,
        action: "confirm",
        fields: ["confirmed_at"],
      },
    });
    return { ok: true, result };
  }

  /** What an emailed link's page shows: public details only. */
  async viewForLink(id: string) {
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    if (!marker || text(marker.cells.status) === "deleted") return undefined;
    return {
      id,
      name: text(marker.cells.name),
      organisation: text(marker.cells.organisation),
      status: text(marker.cells.status),
      confirmed_at: toIsoDate(marker.cells.confirmed_at) ?? "",
    };
  }
}
