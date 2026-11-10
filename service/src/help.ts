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

/**
 * A postscript for people wary of links in email: the site's address as plain text, never a link
 * (email clients may still make it one).
 */
function signInInstead(siteUrl: string): string {
  const host = new URL(siteUrl).host;
  return `P.S. If you want to avoid clicking on links in email, you can go to the OpenMRS Atlas in your browser at ${host} and sign in with your OpenMRS ID.`;
}

export const signInInsteadText = (siteUrl: string) => signInInstead(siteUrl);

export const signInInsteadHtml = (siteUrl: string) => escape(signInInstead(siteUrl));
