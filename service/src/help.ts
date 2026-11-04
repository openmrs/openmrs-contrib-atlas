/**
 * Where Atlas email sends people instead of replying (specs/email-delivery).
 */

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PLACES = [
  { name: "OpenMRS Talk", url: "https://talk.openmrs.org/" },
  { name: "OpenMRS on Slack", url: "https://openmrs.slack.com/" },
] as const;

const NO_REPLY = "Please don't reply to this email; replies aren't read.";

export const NO_REPLY_TEXT = `${NO_REPLY} For help with the Atlas, ask on ${PLACES.map(
  (p) => `${p.name} (${p.url})`,
).join(" or ")}.`;

export const NO_REPLY_HTML = `${escape(NO_REPLY)} For help with the Atlas, ask on ${PLACES.map(
  (p) => `<a href="${escape(p.url)}">${escape(p.name)}</a>`,
).join(" or ")}.`;
