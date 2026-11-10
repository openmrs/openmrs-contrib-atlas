import type { Accounts } from "./accounts.ts";
import type { ClaimDecision } from "./edits.ts";
import { NO_REPLY_HTML, NO_REPLY_TEXT, signInInsteadHtml, signInInsteadText } from "./help.ts";
import type { NoticeConfig } from "./notices.ts";

/**
 * Claim email (specs/marker-claims): the notice to admins when someone claims a marker, and
 * the decision sent to the claimant. Neither ever blocks or undoes the claim or decision, and
 * no address is ever logged.
 */

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const markerUrl = (siteUrl: string, id: string) =>
  `${siteUrl.replace(/\/+$/, "")}/?marker=${encodeURIComponent(id)}`;

const link = (href: string, label: string) => `<a href="${escape(href)}">${escape(label)}</a>`;

const page = (paragraphs: string[], postscript?: string) =>
  [
    '<!doctype html><html><body style="font-family: sans-serif; line-height: 1.5">',
    ...paragraphs.map((p) => `<p>${p}</p>`),
    `<p>${NO_REPLY_HTML}</p>`,
    ...(postscript ? [`<p>${postscript}</p>`] : []),
    "</body></html>",
  ].join("\n");

/** Message text as HTML: escaped, with its line breaks kept. */
const quoted = (message: string) => escape(message).replace(/\r?\n/g, "<br>");

export interface NewClaim {
  marker_id: string;
  name: string;
  username: string;
  message: string;
}

export function renderClaimNotice(
  claim: NewClaim,
  config: Pick<NoticeConfig, "siteUrl" | "sheetUrl">,
) {
  const url = markerUrl(config.siteUrl, claim.marker_id);
  const subject = `Claim for ${claim.name} on the OpenMRS Atlas`;
  const text = [
    `${claim.username} has asked to become the owner of ${claim.name} on the OpenMRS Atlas.`,
    "",
    "How they are connected to the site:",
    claim.message,
    "",
    `Approve or decline it on the map: ${url}`,
    `The claims tab in the sheet: ${config.sheetUrl}`,
    "",
    NO_REPLY_TEXT,
    "",
  ].join("\n");
  const html = page([
    `${escape(claim.username)} has asked to become the owner of <strong>${escape(claim.name)}</strong> on the OpenMRS Atlas.`,
    `How they are connected to the site:<br><em>${quoted(claim.message)}</em>`,
    `${link(url, "Approve or decline it on the map")} · ${link(config.sheetUrl, "Open the sheet")}`,
  ]);
  return { subject, text, html };
}

/** Tells the notice address about a claim; logs and swallows any failure. */
export async function sendClaimNotice(config: NoticeConfig, claim: NewClaim): Promise<void> {
  if (!config.to) return;
  try {
    await config.mailer.send({
      to: config.to,
      ...renderClaimNotice(claim, config),
      kind: "claim-notice",
      markers: [claim.marker_id],
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "claim-notice-failed",
        marker: claim.marker_id,
        message: (err as Error).message,
      }),
    );
  }
}

export function renderClaimDecision(decision: ClaimDecision, siteUrl: string) {
  const url = markerUrl(siteUrl, decision.marker_id);
  const name = decision.name;
  if (decision.approved) {
    return {
      subject: `Your claim for ${name} was approved`,
      text: [
        `Your claim for ${name} on the OpenMRS Atlas was approved. You are now its owner.`,
        "",
        "You can update it, add editors and keep it current from My markers.",
        "",
        `See it on the map: ${url}`,
        "",
        NO_REPLY_TEXT,
        "",
        signInInsteadText(siteUrl),
        "",
      ].join("\n"),
      html: page(
        [
          `Your claim for <strong>${escape(name)}</strong> on the OpenMRS Atlas was approved. You are now its owner.`,
          "You can update it, add editors and keep it current from My markers.",
          link(url, "See it on the map"),
        ],
        signInInsteadHtml(siteUrl),
      ),
    };
  }
  const reason = decision.reason.trim();
  return {
    subject: `Your claim for ${name} was declined`,
    text: [
      `Your claim for ${name} on the OpenMRS Atlas was declined.`,
      ...(reason ? ["", `Reason: ${reason}`] : []),
      "",
      `See it on the map: ${url}`,
      "",
      NO_REPLY_TEXT,
      "",
      signInInsteadText(siteUrl),
      "",
    ].join("\n"),
    html: page(
      [
        `Your claim for <strong>${escape(name)}</strong> on the OpenMRS Atlas was declined.`,
        ...(reason ? [`Reason: ${quoted(reason)}`] : []),
        link(url, "See it on the map"),
      ],
      signInInsteadHtml(siteUrl),
    ),
  };
}

/**
 * Emails each claimant their decision. The address comes from Keycloak inside the admin's
 * signed-in request and goes no further than the mailer.
 */
export async function sendClaimDecisions(
  config: Pick<NoticeConfig, "mailer" | "siteUrl">,
  accounts: Accounts | undefined,
  decisions: ClaimDecision[],
): Promise<void> {
  for (const decision of decisions) {
    const log = (event: string, extra: Record<string, unknown> = {}) =>
      console.error(JSON.stringify({ event, marker: decision.marker_id, ...extra }));
    try {
      const account = accounts ? await accounts.lookup(decision.username) : undefined;
      if (!account?.email) {
        log("claim-decision-no-email");
        continue;
      }
      await config.mailer.send({
        to: account.email,
        ...renderClaimDecision(decision, config.siteUrl),
        kind: "claim-decision",
        markers: [decision.marker_id],
      });
    } catch (err) {
      log("claim-decision-failed", { message: (err as Error).message });
    }
  }
}
