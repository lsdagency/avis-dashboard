/** Shared display formatters. All money is GBP. */

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** £X,XXX.XX */
export function money(n: number): string {
  if (!Number.isFinite(n)) return "£0.00";
  return GBP.format(n);
}

/** X.XX% */
export function percent(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return "0.00%";
  return `${n.toFixed(dp)}%`;
}

/** X.XX (ROAS, multipliers) */
export function ratio(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(dp);
}

/** Signed money, e.g. +£120.00 / -£45.00 — for budget deltas. */
export function signedMoney(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${money(Math.abs(n))}`;
}

/** Truncate a long campaign name for table display. */
export function truncate(s: string, max = 50): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
