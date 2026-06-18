import type { BudgetSummary } from "@/lib/types";

/** Plain-English daily summary shown above the cards. */
export default function DailySummaryCard({ summary }: { summary: BudgetSummary }) {
  return (
    <div className="rounded-xl border-l-4 border-avis-red bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-black/50">
        Daily Summary
      </p>
      <p className="mt-2 font-display text-lg font-bold text-black">
        {summary.headline}
      </p>
      <div className="mt-2 space-y-1 text-sm text-black/70">
        <p>{summary.topPerformer}</p>
        {summary.floorNote && <p>{summary.floorNote}</p>}
        <p>{summary.recommendation}</p>
      </div>
    </div>
  );
}
