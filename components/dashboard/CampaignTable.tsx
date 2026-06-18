"use client";

import { useMemo, useState } from "react";
import type { BudgetRecommendation, Platform } from "@/lib/types";
import { PLATFORMS } from "@/lib/types";
import { money, percent, ratio, signedMoney, truncate } from "@/lib/format";

type Tab = "ALL" | Platform;
type SortKey =
  | "funnelStage"
  | "campaignName"
  | "spend"
  | "roas"
  | "currentBudget"
  | "currentWeightPct"
  | "recommendedBudget"
  | "recommendedWeightPct"
  | "budgetDelta";
type Dir = "asc" | "desc";

const TABS: Tab[] = ["ALL", "META", "REDDIT", "TIKTOK"];

function recTooltip(r: BudgetRecommendation): string {
  if (r.z1Boosted && r.floorTriggered)
    return "Z1 priority region — 1.25× ROAS multiplier applied | 60% Prospecting floor active";
  if (r.z1Boosted) return "Z1 priority region — 1.25× ROAS multiplier applied";
  if (r.floorTriggered) return "60% Prospecting floor active";
  return "Non-priority region — performance-based weight";
}

interface Subtotal {
  spend: number;
  revenue: number;
  currentBudget: number;
  currentWeightPct: number;
  recommendedBudget: number;
  recommendedWeightPct: number;
  budgetDelta: number;
}

function subtotal(rows: BudgetRecommendation[]): Subtotal {
  return rows.reduce<Subtotal>(
    (a, r) => ({
      spend: a.spend + r.spend,
      revenue: a.revenue + r.revenue,
      currentBudget: a.currentBudget + r.currentBudget,
      currentWeightPct: a.currentWeightPct + r.currentWeightPct,
      recommendedBudget: a.recommendedBudget + r.recommendedBudget,
      recommendedWeightPct: a.recommendedWeightPct + r.recommendedWeightPct,
      budgetDelta: a.budgetDelta + r.budgetDelta,
    }),
    {
      spend: 0,
      revenue: 0,
      currentBudget: 0,
      currentWeightPct: 0,
      recommendedBudget: 0,
      recommendedWeightPct: 0,
      budgetDelta: 0,
    },
  );
}

function deltaClass(n: number) {
  if (n > 0) return "text-positive";
  if (n < 0) return "text-negative";
  return "text-black/50";
}

export default function CampaignTable({
  recommendations,
}: {
  recommendations: BudgetRecommendation[];
}) {
  const [tab, setTab] = useState<Tab>("ALL");
  // Per-tab sort state.
  const [sorts, setSorts] = useState<Record<Tab, { key: SortKey; dir: Dir }>>({
    ALL: { key: "funnelStage", dir: "asc" },
    META: { key: "funnelStage", dir: "asc" },
    REDDIT: { key: "funnelStage", dir: "asc" },
    TIKTOK: { key: "funnelStage", dir: "asc" },
  });
  const [regionDir, setRegionDir] = useState<Dir>("asc");

  const sort = sorts[tab];
  const showPlatformCol = tab === "ALL";

  const rows = useMemo(
    () => (tab === "ALL" ? recommendations : recommendations.filter((r) => r.platform === tab)),
    [recommendations, tab],
  );

  function toggleSort(key: SortKey) {
    setSorts((prev) => {
      const cur = prev[tab];
      const dir: Dir = cur.key === key && cur.dir === "asc" ? "desc" : "asc";
      return { ...prev, [tab]: { key, dir } };
    });
  }

  function cmp(a: BudgetRecommendation, b: BudgetRecommendation): number {
    const { key, dir } = sort;
    let d: number;
    if (key === "funnelStage") {
      // Prospecting before Retargeting.
      const av = a.funnelStage === "PROSPECTING" ? 0 : 1;
      const bv = b.funnelStage === "PROSPECTING" ? 0 : 1;
      d = av - bv;
    } else if (key === "campaignName") {
      d = a.campaignName.localeCompare(b.campaignName);
    } else {
      d = (a[key] as number) - (b[key] as number);
    }
    return dir === "asc" ? d : -d;
  }

  // Group rows: platform (ALL view) → region (A→Z by regionDir) → sorted within group.
  const grouped = useMemo(() => {
    const platforms = showPlatformCol ? PLATFORMS : [tab as Platform];
    return platforms
      .map((platform) => {
        const pRows = rows.filter((r) => r.platform === platform);
        const regions = [...new Set(pRows.map((r) => r.region))].sort((x, y) =>
          regionDir === "asc" ? x.localeCompare(y) : y.localeCompare(x),
        );
        const regionGroups = regions.map((region) => ({
          region,
          rows: pRows.filter((r) => r.region === region).sort(cmp),
        }));
        return { platform, regionGroups, rows: pRows };
      })
      .filter((g) => g.rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, showPlatformCol, tab, regionDir, sort]);

  const colCount = showPlatformCol ? 11 : 10;

  const headers: { key?: SortKey; label: string; align?: "right"; region?: boolean }[] = [
    ...(showPlatformCol ? [{ label: "Platform" } as const] : []),
    { label: "Region", region: true },
    { key: "funnelStage" as SortKey, label: "Funnel" },
    { key: "campaignName" as SortKey, label: "Campaign" },
    { key: "spend" as SortKey, label: "Daily Spend", align: "right" as const },
    { key: "roas" as SortKey, label: "ROAS", align: "right" as const },
    { key: "currentBudget" as SortKey, label: "Current Budget", align: "right" as const },
    { key: "currentWeightPct" as SortKey, label: "Curr. Wt %", align: "right" as const },
    { key: "recommendedBudget" as SortKey, label: "Rec. Budget", align: "right" as const },
    { key: "recommendedWeightPct" as SortKey, label: "Rec. Wt %", align: "right" as const },
    { key: "budgetDelta" as SortKey, label: "Budget Change", align: "right" as const },
  ];

  function arrow(active: boolean, dir: Dir) {
    if (!active) return "";
    return dir === "asc" ? " ▲" : " ▼";
  }

  function SubtotalRow({
    label,
    rows: subRows,
    strong,
  }: {
    label: string;
    rows: BudgetRecommendation[];
    strong?: boolean;
  }) {
    const s = subtotal(subRows);
    const roas = s.spend > 0 ? s.revenue / s.spend : 0;
    const base = strong
      ? "bg-avis-red text-white font-bold"
      : "bg-avis-grey font-semibold";
    return (
      <tr className={base}>
        <td className="px-3 py-2" colSpan={showPlatformCol ? 4 : 3}>
          {label}
        </td>
        <td className="px-3 py-2 text-right">{money(s.spend)}</td>
        <td className="px-3 py-2 text-right">{ratio(roas)}</td>
        <td className="px-3 py-2 text-right">{money(s.currentBudget)}</td>
        <td className="px-3 py-2 text-right">{percent(s.currentWeightPct)}</td>
        <td className="px-3 py-2 text-right">{money(s.recommendedBudget)}</td>
        <td className="px-3 py-2 text-right">{percent(s.recommendedWeightPct)}</td>
        <td
          className={`px-3 py-2 text-right ${strong ? "" : deltaClass(s.budgetDelta)}`}
        >
          {signedMoney(s.budgetDelta)}
        </td>
      </tr>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-3 flex flex-wrap gap-1 border-b border-black/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "border-avis-red text-avis-red"
                : "border-transparent text-black/50 hover:text-black"
            }`}
          >
            {t === "ALL" ? "All" : t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-avis-grey text-left text-black">
              {headers.map((h, i) => {
                const active = h.key ? sort.key === h.key : false;
                const clickable = h.key || h.region;
                return (
                  <th
                    key={i}
                    onClick={
                      h.region
                        ? () => setRegionDir((d) => (d === "asc" ? "desc" : "asc"))
                        : h.key
                          ? () => toggleSort(h.key!)
                          : undefined
                    }
                    className={`whitespace-nowrap px-3 py-2 font-bold ${
                      h.align === "right" ? "text-right" : "text-left"
                    } ${clickable ? "cursor-pointer select-none hover:text-avis-red" : ""}`}
                  >
                    {h.label}
                    {h.region ? arrow(true, regionDir) : arrow(active, sort.dir)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-10 text-center text-black/50">
                  No campaign data available for this date.
                </td>
              </tr>
            )}

            {grouped.map((pg) => (
              <PlatformSection key={pg.platform} platform={pg.platform} />
            ))}

            {showPlatformCol && grouped.length > 0 && (
              <SubtotalRow label="Grand total — all platforms" rows={rows} strong />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Renders a platform's region groups + subtotals. Defined inline to capture helpers.
  function PlatformSection({ platform }: { platform: Platform }) {
    const pg = grouped.find((g) => g.platform === platform);
    if (!pg) return null;
    return (
      <>
        {showPlatformCol && (
          <tr className="bg-black/[0.03]">
            <td colSpan={colCount} className="px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide text-black/60">
              {platform}
            </td>
          </tr>
        )}
        {pg.regionGroups.map((rg) => (
          <FragmentRegion key={rg.region} region={rg.region} rows={rg.rows} />
        ))}
        {showPlatformCol && (
          <SubtotalRow label={`${platform} total`} rows={pg.rows} />
        )}
        {!showPlatformCol && <SubtotalRow label={`${platform} grand total`} rows={pg.rows} strong />}
      </>
    );
  }

  function FragmentRegion({ region, rows: rRows }: { region: string; rows: BudgetRecommendation[] }) {
    return (
      <>
        {rRows.map((r, idx) => (
          <tr key={r.platform + r.campaignId} className={idx % 2 ? "bg-gray-50" : "bg-white"}>
            {showPlatformCol && <td className="px-3 py-2 text-black/60">{r.platform}</td>}
            <td className="px-3 py-2 font-medium">{r.region}</td>
            <td className="px-3 py-2">
              {r.funnelStage === "PROSPECTING" ? "Prospecting" : "Retargeting"}
            </td>
            <td className="px-3 py-2" title={r.campaignName}>
              {truncate(r.campaignName)}
            </td>
            <td className="px-3 py-2 text-right">{money(r.spend)}</td>
            <td className="px-3 py-2 text-right">{ratio(r.roas)}</td>
            <td className="px-3 py-2 text-right">{money(r.currentBudget)}</td>
            <td className="px-3 py-2 text-right">{percent(r.currentWeightPct)}</td>
            <td className="px-3 py-2 text-right" title={recTooltip(r)}>
              {money(r.recommendedBudget)}
              {r.z1Boosted && <span className="ml-1 text-avis-red" title="Z1 priority">★</span>}
            </td>
            <td className="px-3 py-2 text-right">{percent(r.recommendedWeightPct)}</td>
            <td className={`px-3 py-2 text-right ${deltaClass(r.budgetDelta)}`}>
              {signedMoney(r.budgetDelta)}
            </td>
          </tr>
        ))}
        <SubtotalRow label={`${region} subtotal`} rows={rRows} />
      </>
    );
  }
}
