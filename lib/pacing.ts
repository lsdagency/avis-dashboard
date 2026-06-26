import type { PacingSummary } from "./types";

/**
 * Monthly budget pacing. Given the month-to-date spend and the current daily run
 * rate, works out how much can be spent today without overspending the month, and
 * whether the account is pacing ahead of or behind the rate needed to land on budget.
 *
 * The recommended daily pool is `min(remaining, evenPace × stance)` — so it can
 * never recommend more than what's left, and it self-corrects: overspend early
 * (a promo) shrinks `remaining`, which lowers the pace for the days that follow.
 */

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export interface PacingInput {
  date: string; // YYYY-MM-DD (today, in the app timezone)
  monthlyBudget: number; // 0 = pacing disabled
  mtdSpend: number; // spend on completed days this month (excludes today)
  mtdSource: "stored" | "override" | "estimated";
  currentDailyRunRate: number; // sum of current daily budgets across platforms
  stancePct: number; // -50 … +50
}

export function computePacing(i: PacingInput): PacingSummary {
  const [y, m, d] = i.date.split("-").map(Number);
  // Day 0 of the next month = last day of this month.
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dayOfMonth = d;
  const daysRemaining = Math.max(1, daysInMonth - d + 1); // including today
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));

  const active = i.monthlyBudget > 0;
  const remaining = Math.max(0, i.monthlyBudget - i.mtdSpend);
  const evenDailyPace = remaining / daysRemaining;
  const stanceFactor = 1 + i.stancePct / 100;
  const recommendedDailyPool = active
    ? Math.max(0, Math.min(remaining, evenDailyPace * stanceFactor))
    : i.currentDailyRunRate;

  const projectedMonthEndSpend = i.mtdSpend + i.currentDailyRunRate * daysRemaining;

  let status: PacingSummary["status"] = "on_track";
  if (active && evenDailyPace > 0) {
    if (i.currentDailyRunRate > evenDailyPace * 1.05) status = "ahead";
    else if (i.currentDailyRunRate < evenDailyPace * 0.95) status = "behind";
  }

  return {
    active,
    monthlyBudget: round(i.monthlyBudget),
    monthLabel,
    daysInMonth,
    dayOfMonth,
    daysRemaining,
    mtdSpend: round(i.mtdSpend),
    mtdSource: i.mtdSource,
    remaining: round(remaining),
    evenDailyPace: round(evenDailyPace),
    stancePct: i.stancePct,
    recommendedDailyPool: round(recommendedDailyPool),
    currentDailyRunRate: round(i.currentDailyRunRate),
    projectedMonthEndSpend: round(projectedMonthEndSpend),
    status,
  };
}
