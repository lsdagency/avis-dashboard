import type { DashboardSummary } from "@/lib/types";
import { money, ratio } from "@/lib/format";
import ProspectingSplitBadge from "./ProspectingSplitBadge";

function Card({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border-l-4 border-avis-red bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-black/50">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-black">{children}</p>
      {note && <p className="mt-1 text-xs text-black/50">{note}</p>}
    </div>
  );
}

/** Five top-level cards rolled up across Meta + Reddit + TikTok. */
export default function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="Total Daily Spend">{money(summary.totalSpend)}</Card>
      <Card label="Blended ROAS">{ratio(summary.blendedRoas)}</Card>
      <Card label="Total Current Budget">{money(summary.totalCurrentBudget)}</Card>
      <Card
        label="Total Recommended Budget"
        note="Same pools, redistributed per platform"
      >
        {money(summary.totalRecommendedBudget)}
      </Card>
      <Card label="Prospecting Split" note="Weighted avg · hover for per-platform">
        <ProspectingSplitBadge
          value={summary.prospectingSplitPct}
          byPlatform={summary.byPlatform}
        />
      </Card>
    </div>
  );
}
