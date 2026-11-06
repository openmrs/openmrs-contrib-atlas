import { afterEach, describe, expect, it, vi } from "vitest";
import { mandrillMailer, parseAllowlist, type Email } from "./mailer.ts";

const EMAIL: Email = {
  to: "Burke@OpenMRS.org",
  subject: "Is Clinic still current?",
  text: "text body",
  html: "<p>html body</p>",
  kind: "reminder",
  markers: ["m1"],
};

function mandrill(answer: () => Response | Promise<Response>) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetchFn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    requests.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return answer();
  }) as typeof fetch;
  return { requests, fetchFn };
}

const from = "OpenMRS Atlas <atlas-noreply@openmrs.org>";

afterEach(() => vi.restoreAllMocks());

describe("One sender", () => {
  it("sends from the no-reply address with tracking off", async () => {
    const { requests, fetchFn } = mandrill(() =>
      Response.json([{ email: EMAIL.to, status: "sent" }]),
    );
    const mailer = mandrillMailer({ apiKey: "key", from }, fetchFn);
    expect(await mailer.send(EMAIL)).toEqual({ status: "sent" });
    const message = requests[0]!.body.message as Record<string, unknown>;
    expect(requests[0]!.url).toBe("https://mandrillapp.com/api/1.0/messages/send");
    expect(message).toMatchObject({
      from_email: "atlas-noreply@openmrs.org",
      from_name: "OpenMRS Atlas",
      to: [{ email: EMAIL.to, type: "to" }],
      track_opens: false,
      track_clicks: false,
      tags: ["atlas-reminder"],
    });
    expect(message).not.toHaveProperty("headers");
  });

  it("counts queued as sent and reports rejections with Mandrill's reason", async () => {
    const queued = mandrill(() => Response.json([{ status: "queued" }]));
    expect(await mandrillMailer({ apiKey: "k", from }, queued.fetchFn).send(EMAIL)).toEqual({
      status: "sent",
    });
    const rejected = mandrill(() =>
      Response.json([{ status: "rejected", reject_reason: "hard-bounce" }]),
    );
    expect(await mandrillMailer({ apiKey: "k", from }, rejected.fetchFn).send(EMAIL)).toEqual({
      status: "rejected",
      reason: "hard-bounce",
    });
  });
});

describe("Failed sends are retried by the next run", () => {
  it("Scenario: Mandrill unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = mandrill(() => {
      throw new TypeError("fetch failed");
    });
    expect((await mandrillMailer({ apiKey: "k", from }, down.fetchFn).send(EMAIL)).status).toBe(
      "failed",
    );
    const badKey = mandrill(() => Response.json({ status: "error" }, { status: 500 }));
    expect((await mandrillMailer({ apiKey: "k", from }, badKey.fetchFn).send(EMAIL)).status).toBe(
      "failed",
    );
  });
});

describe("Staging delivers only to an allowlist", () => {
  it("Scenario: Allowlisted address, matched without regard to case", async () => {
    const { requests, fetchFn } = mandrill(() => Response.json([{ status: "sent" }]));
    const mailer = mandrillMailer(
      { apiKey: "k", from, allowlist: parseAllowlist("burke@openmrs.org") },
      fetchFn,
    );
    expect(await mailer.send(EMAIL)).toEqual({ status: "sent" });
    expect(requests).toHaveLength(1);
  });

  it("Scenario: Reminder on staging, logged without the address or body", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => logs.push(line));
    const { requests, fetchFn } = mandrill(() => Response.json([{ status: "sent" }]));
    const mailer = mandrillMailer(
      { apiKey: "k", from, allowlist: parseAllowlist(" someone@else.org , other@x.org") },
      fetchFn,
    );
    expect(await mailer.send(EMAIL)).toEqual({ status: "withheld" });
    expect(requests).toHaveLength(0);
    expect(logs.join("\n")).toContain('"event":"email-withheld"');
    expect(logs.join("\n")).toContain('"markers":["m1"]');
    expect(logs.join("\n").toLowerCase()).not.toContain("burke@openmrs.org");
    expect(logs.join("\n")).not.toContain("text body");
  });

  it("delivers to nobody when the allowlist holds no addresses", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { fetchFn } = mandrill(() => Response.json([{ status: "sent" }]));
    const mailer = mandrillMailer(
      { apiKey: "k", from, allowlist: parseAllowlist("none") },
      fetchFn,
    );
    expect(await mailer.send(EMAIL)).toEqual({ status: "withheld" });
  });

  it("Scenario: Production after review (`*` means no allowlist)", async () => {
    const { requests, fetchFn } = mandrill(() => Response.json([{ status: "sent" }]));
    const mailer = mandrillMailer({ apiKey: "k", from, allowlist: parseAllowlist(" * ") }, fetchFn);
    expect(await mailer.send(EMAIL)).toEqual({ status: "sent" });
    expect(requests).toHaveLength(1);
  });

  it("treats an empty allowlist as no one", () => {
    expect(parseAllowlist("")).toEqual([]);
    expect(parseAllowlist(undefined)).toBeUndefined();
  });
});

describe("Email is never sent without configuration", () => {
  it("Scenario: Local development", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => logs.push(line));
    const { requests, fetchFn } = mandrill(() => Response.json([{ status: "sent" }]));
    const mailer = mandrillMailer({ from }, fetchFn);
    expect(await mailer.send(EMAIL)).toEqual({ status: "off" });
    expect(requests).toHaveLength(0);
    expect(logs[0]).toContain('"event":"email-off"');
  });
});
