export type Part = { text: string } | { url: string };

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/** Splits plain text into text and URL parts; rendering them as React nodes keeps them escaped. */
export function linkify(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING_PUNCTUATION, "");
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
