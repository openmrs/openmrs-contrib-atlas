import {
  isUsername,
  normaliseUsername,
  text,
  type Cell,
  type Person,
  type RawRow,
} from "@openmrs-atlas/shared";
import {
  ApiError,
  MS_PER_DAY,
  OFFER_DAYS,
  Tabs,
  forbidden,
  invalidUsername,
  offerGone,
  requireRecentSignIn,
  type MarkerResult,
} from "./core.ts";
import { EditorBase } from "./editor-base.ts";

const alreadyOwner = (field: string) =>
  new ApiError(422, {
    error: "That person already owns this marker.",
    errors: [{ field, reason: "That person already owns this marker." }],
  });

/** Editors and ownership transfers (specs/marker-ownership). */
export class People extends EditorBase {
  async addEditor(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "manage-editors");
    const editor = normaliseUsername(username);
    if (!isUsername(editor)) throw invalidUsername("username");
    if (editor === normaliseUsername(priv?.owner ?? "")) throw alreadyOwner("username");
    const current = priv?.editors ?? [];
    // Already an editor: nothing to do, and nothing to report.
    if (current.some((e) => normaliseUsername(e) === editor)) {
      return { ...this.result(tabs, marker.cells, false), editors: current };
    }
    await this.requireAccounts([editor], "username");
    const editors = [...current, editor];
    return this.saveEditors(person, tabs, marker, id, current, editors);
  }

  async removeEditor(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "manage-editors");
    const current = priv?.editors ?? [];
    const editors = current.filter((e) => normaliseUsername(e) !== normaliseUsername(username));
    if (editors.length === current.length) {
      return { ...this.result(tabs, marker.cells, false), editors: current };
    }
    return this.saveEditors(person, tabs, marker, id, current, editors);
  }

  private async saveEditors(
    person: Person,
    tabs: Tabs,
    marker: RawRow,
    id: string,
    before: string[],
    editors: string[],
  ) {
    const result = await this.restartClock(tabs, marker, {
      privateCells: { editors: editors.join(",") },
      log: {
        person,
        action: "edit",
        fields: [{ field: "editors", from: before.join(","), to: editors.join(",") }],
      },
    });
    return { ...result, editors };
  }

  async offer(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "transfer");
    // Giving a marker away needs a recent sign-in, even for its owner (specs/user-sign-in).
    requireRecentSignIn(person, this.now());
    const to = normaliseUsername(username);
    if (!isUsername(to)) throw invalidUsername("username");
    if (!priv?.owner) throw new ApiError(409, { error: "This marker has no owner to transfer." });
    if (to === normaliseUsername(priv.owner)) throw alreadyOwner("username");
    await this.requireAccounts([to], "username");
    const now = this.now();
    const expires = new Date(now.getTime() + OFFER_DAYS * MS_PER_DAY).toISOString();
    await this.clearOffers(tabs, id);
    await this.store.appendRow(
      "pending",
      tabs.header.pending.map(
        (column) =>
          (
            ({
              marker_id: id,
              from: priv.owner,
              to,
              created_at: now.toISOString(),
              expires_at: expires,
            }) as Record<string, Cell>
          )[column] ?? "",
      ),
    );
    const result = await this.restartClock(tabs, marker, {
      log: { person, action: "transfer-offer", fields: [{ field: "owner", from: priv.owner, to }] },
    });
    return { ...result, offer_to: to };
  }

  async cancelOffer(person: Person, id: string) {
    const tabs = await this.tabs();
    this.find(tabs, person, id, "transfer");
    if (!this.openOffer(tabs, id)) throw offerGone();
    await this.clearOffers(tabs, id);
    await this.log(person, id, "transfer-cancel", []);
  }

  private recipientOffer(tabs: Tabs, person: Person, id: string) {
    const offer = this.openOffer(tabs, id);
    if (!offer) throw offerGone();
    if (normaliseUsername(offer.to) !== person.username) throw forbidden();
    const marker = tabs.marker(id);
    if (!marker || text(marker.cells.status) === "deleted") throw offerGone();
    return { offer, marker };
  }

  async accept(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { offer, marker } = this.recipientOffer(tabs, person, id);
    const priv = tabs.privateOf(id);
    const editors = (priv?.editors ?? []).filter(
      (e) =>
        normaliseUsername(e) !== person.username &&
        normaliseUsername(e) !== normaliseUsername(offer.from),
    );
    // The previous owner stays on as an editor until the new owner removes them.
    editors.push(offer.from);
    const result = await this.restartClock(tabs, marker, {
      privateCells: { owner: person.username, editors: editors.join(",") },
      log: {
        person,
        action: "transfer",
        fields: [{ field: "owner", from: offer.from, to: person.username }],
      },
    });
    await this.clearOffers(tabs, id);
    return result;
  }

  async decline(person: Person, id: string) {
    const tabs = await this.tabs();
    this.recipientOffer(tabs, person, id);
    await this.clearOffers(tabs, id);
    await this.log(person, id, "transfer-decline", []);
  }
}
