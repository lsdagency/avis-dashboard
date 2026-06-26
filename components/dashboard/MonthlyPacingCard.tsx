import type { PacingSummary } from "@/lib/types";
import { money, percent } from "@/lib/format";

const STATUS: Record<
  PacingSummary["status"],
  { label: string; cls: string }
> = {
  ahead: { label: "Pacing ahead", cls: "bg-avis-red-soft text-avis-red" },
  behind: { label: "Pacing behind", cls: "bg-amber-100 text-amber-800" },
  on_track: { label: "On track", cls: "bg-positive-soft text-positive" },
};

const SOURCE_NOTE: Record<PacingSummary["mtdSource"], string> = {
  stored: "from tracked spend",
  override: "manual override",
  estimated: "estimated",
};

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-black/45">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold text-black">{value}</p>
      {sub && <p className="text-xs text-black/45">{sub}</p>}
    </div>
  );
}

/** Monthly budget pacing card — shown above the summary cards when active. */
export default function MonthlyPacingCard({ pacing }: { pacing: PacingSummary }) {
  if (!pacing.active) return null;

  const spentPct =
    pacing.monthlyBudget > 0
      ? Math.min(100, (pacing.mtdSpend / pacing.monthlyBudget) * 100)
      : 0;
  // Where spend "should" be by now (fraction of the month elapsed before today).
  const idealPct =
    pacing.daysInMonth > 0
      ? Math.min(100, ((pacing.dayOfMonth - 1) / pacing.daysInMonth) * 100)
      : 0;

  const overBudget = pacing.projectedMonthEndSpend > pacing.monthlyBudget;
  const status = STATUS[pacing.status];

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold">
          Monthly pacing · {pacing.monthLabel}
        </h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {/* Progress bar: spend vs budget, with an "ideal by today" marker */}
      <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-avis-grey">
        <div
          className="h-3 rounded-full bg-avis-red"
          style={{ width: `${spentPct}%` }}
        />
        <div
          className="absolute top-0 h-3 w-px bg-black/60"
          style={{ left: `${idealPct}%` }}
          title="Where spend should be by today"
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-black/45">
        <span>{money(pacing.mtdSpend)} spent</span>
        <span>{money(pacing.monthlyBudget)} budget</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Spent so far" value={money(pacing.mtdSpend)} sub={SOURCE_NOTE[pacing.mtdSource]} />
        <Stat label="Remaining" value={money(pacing.remaining)} />
        <Stat
          label="Days left"
          value={`${pacing.daysRemaining}`}
          sub={`of ${pacing.daysInMonth}`}
        />
        <Stat
          label="Even daily pace"
          value={money(pacing.evenDailyPace)}
          sub="remaining ÷ days left"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-black/5 pt-4 sm:grid-cols-3">
        <Stat
          label="Current run rate"
          value={money(pacing.currentDailyRunRate)}
          sub="today's set budgets"
        />
        <Stat
          label="Recommended today"
          value={money(pacing.recommendedDailyPool)}
          sub={
            pacing.stancePct === 0
              ? "even pace"
              : `${pacing.stancePct > 0 ? "+" : ""}${pacing.stancePct}% stance`
          }
        />
        <Stat
          label="Projected month-end"
          value={money(pacing.projectedMonthEndSpend)}
          sub={
            overBudget
              ? `${money(pacing.projectedMonthEndSpend - pacing.monthlyBudget)} over budget`
              : `${money(pacing.monthlyBudget - pacing.projectedMonthEndSpend)} under budget`
          }
        />
      </div>

      <p className="mt-4 text-sm text-black/60">
        {pacing.status === "ahead" &&
          `At the current run rate you'd finish ${money(
            pacing.projectedMonthEndSpend - pacing.monthlyBudget,
          )} over budget — today's recommended budgets pull spend back to ${money(
            pacing.recommendedDailyPool,
          )} to stay on track.`}
        {pacing.status === "behind" &&
          `You're under-pacing — there's room to scale up. Today's recommendation lifts spend toward ${money(
            pacing.recommendedDailyPool,
          )} (${percent((pacing.recommendedDailyPool / Math.max(pacing.monthlyBudget, 1)) * 100)} of budget).`}
        {pacing.status === "on_track" &&
          `Spend is tracking the pace needed to land on budget. Today's recommended total is ${money(
            pacing.recommendedDailyPool,
          )}.`}
      </p>
    </div>
  );
}
