/** `iso` plus whole calendar months, in UTC. */
export function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  const out = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + months,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  );
  // Keep the day of the month, or the month's last day if it is shorter (31 Jan + 1 = 28 Feb).
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return out;
}

/** Months after which a marker needs a deliberate confirmation: the first reminder's stage. */
export const CONFIRM_AFTER_MONTHS = 12;

/**
 * True when a marker needs someone to confirm it on purpose: never confirmed, or confirmed 12 or
 * more months ago. Until then, signing in keeps it current and "Still current" isn't offered.
 */
export function needsConfirming(confirmedAt: string | undefined, now: Date): boolean {
  if (!confirmedAt || Number.isNaN(new Date(confirmedAt).getTime())) return true;
  return addMonths(confirmedAt, CONFIRM_AFTER_MONTHS).getTime() <= now.getTime();
}
