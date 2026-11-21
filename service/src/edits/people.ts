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
  type MarkerResult,
} from "./core.ts";
import { EditorBase } from "./editor-base.ts";

/** Editors and ownership transfers (specs/marker-ownership). */
export class People extends EditorBase {
  async addEditor(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "manage-editors");
    const editor = normaliseUsername(username);
    if (!isUsername(editor)) throw invalidUsername("username");
    const current = priv?.editors ?? [];
    const listed = current.some((e) => normaliseUsername(e) === editor);
    if (listed || editor === normaliseUsername(priv?.owner ?? "")) {
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
    await this.writePrivate(tabs, id, { editors: editors.join(",") });
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "edit", [
      { field: "editors", from: before.join(","), to: editors.join(",") },
    ]);
    return { ...result, editors };
  }

  async offer(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "transfer");
    const to = normaliseUsername(username);
    if (!isUsername(to)) throw invalidUsername("username");
    if (!priv?.owner) throw new ApiError(409, { error: "This marker has no owner to transfer." });
    if (to === normaliseUsername(priv.owner)) {
      throw new ApiError(422, { error: "That person already owns this marker." });
    }
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
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "transfer-offer", [{ field: "owner", from: priv.owner, to }]);
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
    await this.writePrivate(tabs, id, { owner: person.username, editors: editors.join(",") });
    await this.clearOffers(tabs, id);
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "transfer", [
      { field: "owner", from: offer.from, to: person.username },
    ]);
    return result;
  }

  async decline(person: Person, id: string) {
    const tabs = await this.tabs();
    this.recipientOffer(tabs, person, id);
    await this.clearOffers(tabs, id);
    await this.log(person, id, "transfer-decline", []);
  }
}
