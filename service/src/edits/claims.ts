import { randomUUID } from "node:crypto";
import { normaliseUsername, text, type Cell, type Person } from "@openmrs-atlas/shared";
import {
  ANOTHER_APPROVED,
  ApiError,
  MAX_CLAIM_MESSAGE,
  MAX_CLAIM_REASON,
  MAX_PENDING_CLAIMS,
  Tabs,
  forbidden,
  notFound,
  type Claim,
  type ClaimDecision,
  type MarkerResult,
} from "./core.ts";
import { EditorBase } from "./editor-base.ts";

/** Claims on markers with no owner (specs/marker-claims). */
export class Claims extends EditorBase {
  /** Markers this person may claim now: public, no owner, and no claim of theirs waiting. */
  /** Used by `me`. */
  claimable(tabs: Tabs, person: Person): string[] {
    const mine = new Set(
      tabs
        .pendingClaims()
        .filter((c) => c.username === person.username)
        .map((c) => c.marker_id),
    );
    return tabs.markers
      .filter((m) => {
        const id = text(m.cells.id);
        const status = text(m.cells.status);
        return (
          id !== "" &&
          (status === "active" || status === "closed") &&
          !tabs.privateOf(id)?.owner &&
          !mine.has(id)
        );
      })
      .map((m) => text(m.cells.id));
  }

  /** Asks for ownership of a marker with no owner (specs/marker-claims). */
  async claim(person: Person, id: string, message: unknown) {
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    const status = text(marker?.cells.status);
    if (!marker || (status !== "active" && status !== "closed")) throw notFound();
    if (tabs.privateOf(id)?.owner) {
      throw new ApiError(409, { error: "This site already has an owner." });
    }
    const text_ = typeof message === "string" ? message.trim() : "";
    if (!text_) {
      throw new ApiError(422, {
        error: "Please say how you are connected to this site.",
        errors: [{ field: "message", reason: "Please say how you are connected to this site." }],
      });
    }
    if (text_.length > MAX_CLAIM_MESSAGE) {
      throw new ApiError(422, {
        error: `Please keep the message to ${MAX_CLAIM_MESSAGE.toLocaleString("en")} characters.`,
        errors: [{ field: "message", reason: `At most ${MAX_CLAIM_MESSAGE} characters.` }],
      });
    }
    const mine = tabs.pendingClaims().filter((c) => c.username === person.username);
    if (mine.some((c) => c.marker_id === id)) {
      throw new ApiError(409, { error: "Your claim for this site is already waiting." });
    }
    if (mine.length >= MAX_PENDING_CLAIMS) {
      throw new ApiError(429, {
        error: `You have ${MAX_PENDING_CLAIMS} claims waiting. Please wait for an admin to answer them.`,
      });
    }
    const claim = {
      id: randomUUID(),
      marker_id: id,
      username: person.username,
      message: text_,
      created_at: this.stamp(),
      status: "pending",
    };
    await this.store.appendRow(
      "claims",
      tabs.header.claims.map((column) => (claim as Record<string, Cell>)[column] ?? ""),
    );
    // The message stays in the claims tab; the change log names only the claim.
    await this.log(person, id, "claim", [{ claim: claim.id }]);
    return { claim, name: text(marker.cells.name) };
  }

  private pendingClaim(tabs: Tabs, id: string, claimId: string) {
    const claim = tabs.claims.find((c) => c.id === claimId && c.marker_id === id);
    if (!claim) throw new ApiError(404, { error: "That claim was not found." });
    if (claim.status !== "pending") {
      throw new ApiError(410, { error: "That claim is no longer open." });
    }
    return claim;
  }

  private async decide(tabs: Tabs, claim: Claim, status: string, by: string, reason: string) {
    const header = tabs.header.claims;
    const values: Record<string, Cell> = {
      status,
      decided_by: by,
      decided_at: this.stamp(),
      reason,
    };
    await this.store.updateCells(
      Object.entries(values).map(([field, value]) => ({
        tab: "claims" as const,
        row: claim.row,
        column: header.indexOf(field),
        value,
      })),
    );
  }

  /** Used when an admin sets an owner (`change`). */
  async declineAll(
    tabs: Tabs,
    person: Person,
    id: string,
    claims: Claim[],
    reason: string,
  ): Promise<ClaimDecision[]> {
    const name = text(tabs.marker(id)?.cells.name);
    for (const claim of claims) {
      await this.decide(tabs, claim, "declined", person.username, reason);
      await this.log(person, id, "claim-decline", [{ claim: claim.id }]);
    }
    return claims.map((c) => ({
      marker_id: id,
      name,
      username: c.username,
      approved: false,
      reason,
    }));
  }

  async withdrawClaim(person: Person, id: string, claimId: string) {
    const tabs = await this.tabs();
    const claim = this.pendingClaim(tabs, id, claimId);
    if (claim.username !== person.username) throw forbidden();
    await this.decide(tabs, claim, "withdrawn", person.username, "");
    await this.log(person, id, "claim-withdraw", [{ claim: claim.id }]);
  }

  /** Makes the claimant the owner and answers every other claim on the marker. */
  async approveClaim(
    person: Person,
    id: string,
    claimId: string,
  ): Promise<MarkerResult & { decisions: ClaimDecision[] }> {
    if (!person.admin) throw forbidden();
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    if (!marker) throw notFound();
    const claim = this.pendingClaim(tabs, id, claimId);
    const priv = tabs.privateOf(id);
    if (priv?.owner) throw new ApiError(409, { error: "This site already has an owner." });
    const editors = (priv?.editors ?? []).filter((e) => normaliseUsername(e) !== claim.username);
    const result = await this.restartClock(tabs, marker, {
      privateCells: { owner: claim.username, editors: editors.join(",") },
      log: {
        person,
        action: "claim-approve",
        fields: [{ claim: claim.id }, { field: "owner", from: "", to: claim.username }],
      },
    });
    await this.clearOffers(tabs, id);
    await this.decide(tabs, claim, "approved", person.username, "");
    const others = tabs.pendingClaims(id).filter((c) => c.id !== claim.id);
    const declined = await this.declineAll(tabs, person, id, others, ANOTHER_APPROVED);
    const name = text(marker.cells.name);
    return {
      ...result,
      decisions: [
        { marker_id: id, name, username: claim.username, approved: true, reason: "" },
        ...declined,
      ],
    };
  }

  async declineClaim(
    person: Person,
    id: string,
    claimId: string,
    reason: unknown,
  ): Promise<ClaimDecision> {
    if (!person.admin) throw forbidden();
    if (reason !== undefined && typeof reason !== "string") {
      throw new ApiError(400, { error: "That request is not valid." });
    }
    const why = (reason ?? "").trim();
    if (why.length > MAX_CLAIM_REASON) {
      throw new ApiError(422, {
        error: `Please keep the reason to ${MAX_CLAIM_REASON} characters.`,
        errors: [{ field: "reason", reason: `At most ${MAX_CLAIM_REASON} characters.` }],
      });
    }
    const tabs = await this.tabs();
    if (!tabs.marker(id)) throw notFound();
    const claim = this.pendingClaim(tabs, id, claimId);
    const [decision] = await this.declineAll(tabs, person, id, [claim], why);
    return decision!;
  }
}
