/**
 * Sends Atlas email through Mandrill (Mailchimp Transactional). See specs/email-delivery.
 *
 * Addresses are never logged. With an allowlist (staging), only listed addresses get email;
 * the rest are withheld and logged by kind and marker. With no API key, email is off.
 */

export type EmailKind = "reminder" | "notice";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
  kind: EmailKind;
  /** Marker ids the email is about, for logs. */
  markers: string[];
}

export type SendResult =
  | { status: "sent" }
  | { status: "withheld" }
  | { status: "rejected"; reason: string }
  | { status: "failed"; message: string }
  | { status: "off" };

export interface Mailer {
  send(email: Email): Promise<SendResult>;
}

export interface MandrillConfig {
  apiKey?: string;
  /** "Name <address>" or a bare address. */
  from: string;
  /** Lower-case addresses; undefined means deliver to anyone. */
  allowlist?: string[];
}

const ENDPOINT = "https://mandrillapp.com/api/1.0/messages/send";
const TIMEOUT_MS = 15_000;

function parseFrom(from: string): { from_email: string; from_name?: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return match
    ? { from_email: match[2]!.trim(), ...(match[1] ? { from_name: match[1] } : {}) }
    : { from_email: from.trim() };
}

/**
 * Parses EMAIL_ALLOWLIST: separated by commas or spaces, case-insensitive. Unset, or `*`, means no allowlist
 * (everyone). `*` exists because a Cloud Run deploy can't unset a variable it once set; the deploy
 * workflow sends it only to production. Empty means an allowlist of no one.
 */
export function parseAllowlist(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === "*") return undefined;
  return value
    .split(/[\s,]+/)
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

export function mandrillMailer(config: MandrillConfig, fetchFn: typeof fetch = fetch): Mailer {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) console.log(JSON.stringify({ event: "email-off", reason: "no MANDRILL_API_KEY" }));
  const from = parseFrom(config.from);

  return {
    async send(email) {
      const log = { kind: email.kind, markers: email.markers };
      if (!apiKey) {
        console.log(JSON.stringify({ event: "email-not-sent", reason: "off", ...log }));
        return { status: "off" };
      }
      if (config.allowlist && !config.allowlist.includes(email.to.trim().toLowerCase())) {
        console.log(JSON.stringify({ event: "email-withheld", ...log }));
        return { status: "withheld" };
      }

      let res: Response;
      try {
        res = await fetchFn(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body: JSON.stringify({
            key: apiKey,
            message: {
              ...from,
              to: [{ email: email.to, type: "to" }],
              subject: email.subject,
              text: email.text,
              html: email.html,
              auto_text: false,
              // Click tracking would rewrite links through Mandrill, exposing tokens.
              track_opens: false,
              track_clicks: false,
              view_content_link: false,
              preserve_recipients: false,
              tags: [`atlas-${email.kind}`],
            },
          }),
        });
      } catch (err) {
        const message = (err as Error).message;
        console.error(JSON.stringify({ event: "email-failed", message, ...log }));
        return { status: "failed", message };
      }

      const body: unknown = await res.json().catch(() => undefined);
      const result = Array.isArray(body)
        ? (body[0] as { status?: string; reject_reason?: string } | undefined)
        : undefined;
      if (!res.ok || !result) {
        const message = `Mandrill answered ${res.status}`;
        console.error(JSON.stringify({ event: "email-failed", message, ...log }));
        return { status: "failed", message };
      }
      if (result.status === "rejected" || result.status === "invalid") {
        const reason = result.reject_reason || result.status;
        console.log(JSON.stringify({ event: "email-rejected", reason, ...log }));
        return { status: "rejected", reason };
      }
      console.log(JSON.stringify({ event: "email-sent", ...log }));
      return { status: "sent" };
    },
  };
}
