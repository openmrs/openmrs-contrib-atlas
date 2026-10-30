const names = new Intl.DisplayNames(["en"], { type: "region" });

/** English name for an ISO 3166-1 alpha-2 code, or the code itself if unknown. */
export function countryName(code: string | undefined): string {
  if (!code) return "";
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}
