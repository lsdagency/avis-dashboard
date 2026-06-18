import type { BudgetSummary } from "@/lib/types";

/** Plain-English daily summary (Claude or heuristic) shown above the cards. */
export default function AiSummaryCard({ summary }: { summary: BudgetSummary }) {
  return (
    <div className="rounded-xl border-l-4 border-avis-red bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-black/50">
          AI Insight
        </p>
        <span className="rounded-full bg-avis-grey px-2 py-0.5 text-[10px] uppercase tracking-wide text-black/50">
          {summary.generatedBy === "claude" ? `Claude · ${summary.model ?? ""}` : "Heuristic"}
        </span>
      </div>
      <p className="mt-2 font-display text-lg font-bold text-black">
        {summary.headline}
      </p>
      <div className="mt-2 space-y-1 text-sm italic text-black/70">
        <p>{summary.topPerformer}</p>
        {summary.floorNote && <p>{summary.floorNote}</p>}
        <p>{summary.recommendation}</p>
      </div>
    </div>
  );
}
