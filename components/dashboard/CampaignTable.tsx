"use client";

import { useMemo, useState } from "react";
import type { BudgetRecommendation, Platform } from "@/lib/types";
import { PLATFORMS, Z1_REGIONS } from "@/lib/types";
import { money, percent, ratio, signedMoney, truncate } from "@/lib/format";

type Tab = "ALL" | Platform;
type SortKey =
  | "funnelStage"
  | "campaignName"
  | "spend"
  | "roas"
  | "currentBudget"
  | "recommendedBudget"
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

function deltaClass(n: number) {
  if (n > 0) return "text-positive";
  if (n < 0) return "text-negative";
  return "text-black/40";
}

interface Totals {
  spend: number;
  revenue: number;
  currentBudget: number;
  currentWeightPct: number;
  recommendedBudget: number;
  recommendedWeightPct: number;
  budgetDelta: number;
}
function totals(rows: BudgetRecommendation[]): Totals {
  return rows.reduce<Totals>(
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

export default function CampaignTable({
  recommendations,
}: {
  recommendations: BudgetRecommendation[];
}) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [sorts, setSorts] = useState<Record<Tab, { key: SortKey; dir: Dir }>>({
    ALL: { key: "funnelStage", dir: "asc" },
    META: { key: "funnelStage", dir: "asc" },
    REDDIT: { key: "funnelStage", dir: "asc" },
    TIKTOK: { key: "funnelStage", dir: "asc" },
  });
  const [regionDir, setRegionDir] = useState<Dir>("asc");

  const sort = sorts[tab];

  function toggleSort(key: SortKey) {
    setSorts((prev) => {
      const cur = prev[tab];
      const dir: Dir = cur.key === key && cur.dir === "asc" ? "desc" : "asc";
      return { ...prev, [tab]: { key, dir } };
    });
  }

  const platforms = tab === "ALL" ? PLATFORMS : [tab as Platform];
  const grand = useMemo(
    () => totals(recommendations.filter((r) => platforms.includes(r.platform))),
    [recommendations, platforms],
  );

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-black/10">
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

      {/* One self-contained table card per platform */}
      {platforms.map((platform) => (
        <PlatformTable
          key={platform}
          platform={platform}
          rows={recommendations.filter((r) => r.platform === platform)}
          sort={sort}
          regionDir={regionDir}
          onSort={toggleSort}
          onRegionToggle={() => setRegionDir((d) => (d === "asc" ? "desc" : "asc"))}
        />
      ))}

      {/* Grand total across all platforms (only meaningful in the All view) */}
      {tab === "ALL" && recommendations.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-avis-red px-5 py-3 text-white">
          <span className="font-display font-bold">All platforms</span>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>Spend <b>{money(grand.spend)}</b></span>
            <span>
              Blended ROAS{" "}
              <b>{ratio(grand.spend > 0 ? grand.revenue / grand.spend : 0)}</b>
            </span>
            <span>
              Budget <b>{money(grand.currentBudget)} → {money(grand.recommendedBudget)}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformTable({
  platform,
  rows,
  sort,
  regionDir,
  onSort,
  onRegionToggle,
}: {
  platform: Platform;
  rows: BudgetRecommendation[];
  sort: { key: SortKey; dir: Dir };
  regionDir: Dir;
  onSort: (k: SortKey) => void;
  onRegionToggle: () => void;
}) {
  const t = totals(rows);
  const blended = t.spend > 0 ? t.revenue / t.spend : 0;
  const prospectingPct =
    t.recommendedBudget > 0
      ? (rows
          .filter((r) => r.funnelStage === "PROSPECTING")
          .reduce((a, r) => a + r.recommendedBudget, 0) /
          t.recommendedBudget) *
        100
      : 0;
  const maxAbsDelta = Math.max(1, ...rows.map((r) => Math.abs(r.budgetDelta)));

  function cmp(a: BudgetRecommendation, b: BudgetRecommendation) {
    const { key, dir } = sort;
    let d: number;
    if (key === "funnelStage") {
      d = (a.funnelStage === "PROSPECTING" ? 0 : 1) - (b.funnelStage === "PROSPECTING" ? 0 : 1);
    } else if (key === "campaignName") {
      d = a.campaignName.localeCompare(b.campaignName);
    } else {
      d = (a[key] as number) - (b[key] as number);
    }
    return dir === "asc" ? d : -d;
  }

  const regions = [...new Set(rows.map((r) => r.region))].sort((x, y) =>
    regionDir === "asc" ? x.localeCompare(y) : y.localeCompare(x),
  );

  const headers: { key?: SortKey; label: string; align?: "right"; region?: boolean }[] = [
    { label: "Region", region: true },
    { key: "funnelStage", label: "Funnel" },
    { key: "campaignName", label: "Campaign" },
    { key: "spend", label: "Spend", align: "right" },
    { key: "roas", label: "ROAS", align: "right" },
    { key: "recommendedBudget", label: "Budget (current → rec.)", align: "right" },
    { key: "budgetDelta", label: "Change", align: "right" },
    { label: "Weight", align: "right" },
  ];

  function arrow(active: boolean, dir: Dir) {
    return active ? (dir === "asc" ? " ▲" : " ▼") : "";
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      {/* Card header with platform totals */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white px-4 py-3">
        <h3 className="font-display text-base font-bold">{platform}</h3>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/60">
          <span>Spend <b className="text-black">{money(t.spend)}</b></span>
          <span>ROAS <b className="text-black">{ratio(blended)}</b></span>
          <span>
            Budget{" "}
            <b className="text-black">
              {money(t.currentBudget)} → {money(t.recommendedBudget)}
            </b>
          </span>
          <span>Prospecting <b className="text-black">{percent(prospectingPct)}</b></span>
        </div>
      </div>

      <div className="overflow-x-auto">
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
                      h.region ? onRegionToggle : h.key ? () => onSort(h.key!) : undefined
                    }
                    className={`whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wide ${
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-black/50">
                  No campaign data available for this date.
                </td>
              </tr>
            )}

            {regions.map((region) => {
              const regionRows = rows.filter((r) => r.region === region).sort(cmp);
              const rt = totals(regionRows);
              const z1 = Z1_REGIONS.has(region);
              return (
                <RegionGroup
                  key={region}
                  region={region}
                  z1={z1}
                  rows={regionRows}
                  rt={rt}
                  maxAbsDelta={maxAbsDelta}
                />
              );
            })}

            {/* Platform total */}
            {rows.length > 0 && (
              <tr className="bg-avis-grey font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {platform} total
                </td>
                <td className="px-3 py-2 text-right">{money(t.spend)}</td>
                <td className="px-3 py-2 text-right">{ratio(blended)}</td>
                <td className="px-3 py-2 text-right">
                  {money(t.currentBudget)} → {money(t.recommendedBudget)}
                </td>
                <td className={`px-3 py-2 text-right ${deltaClass(t.budgetDelta)}`}>
                  {signedMoney(t.budgetDelta)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-black/60">100%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegionGroup({
  region,
  z1,
  rows,
  rt,
  maxAbsDelta,
}: {
  region: string;
  z1: boolean;
  rows: BudgetRecommendation[];
  rt: Totals;
  maxAbsDelta: number;
}) {
  return (
    <>
      {rows.map((r, idx) => {
        const barPct = Math.round((Math.abs(r.budgetDelta) / maxAbsDelta) * 100);
        return (
          <tr key={r.campaignId} className={idx % 2 ? "bg-gray-50/60" : "bg-white"}>
            {/* Region — Z1 priority highlighted */}
            <td className="whitespace-nowrap px-3 py-2 font-bold">
              {z1 ? (
                <span className="text-avis-red" title="Z1 priority region — 1.25× ROAS multiplier">
                  ★ {region}
                </span>
              ) : (
                <span className="text-black/70">{region}</span>
              )}
            </td>
            <td className="px-3 py-2">
              <span className="rounded bg-black/[0.06] px-2 py-0.5 text-xs text-black/70">
                {r.funnelStage === "PROSPECTING" ? "Prospecting" : "Retargeting"}
              </span>
            </td>
            <td className="px-3 py-2 text-black/70" title={r.campaignName}>
              {truncate(r.campaignName, 38)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{money(r.spend)}</td>
            <td className="px-3 py-2 text-right font-medium tabular-nums">{ratio(r.roas)}</td>
            <td className="px-3 py-2 text-right tabular-nums" title={recTooltip(r)}>
              <span className="text-black/40">{money(r.currentBudget)}</span>
              <span className="mx-1 text-black/30">→</span>
              <span className="font-bold text-black">{money(r.recommendedBudget)}</span>
            </td>
            <td className="px-3 py-2 text-right">
              <div className={`tabular-nums ${deltaClass(r.budgetDelta)}`}>
                {r.budgetDelta > 0 ? "▲" : r.budgetDelta < 0 ? "▼" : ""}{" "}
                {signedMoney(r.budgetDelta)}
              </div>
              <div className="mt-1 ml-auto h-1 w-20 overflow-hidden rounded bg-black/5">
                <div
                  className={`h-1 rounded ${r.budgetDelta >= 0 ? "bg-positive" : "bg-negative"}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-black/50">
              {percent(r.currentWeightPct)}
              <span className="mx-1 text-black/30">→</span>
              <span className="text-black/80">{percent(r.recommendedWeightPct)}</span>
            </td>
          </tr>
        );
      })}
      {/* Region subtotal */}
      <tr className="border-y border-black/5 bg-black/[0.03] text-xs font-semibold text-black/70">
        <td className="px-3 py-1.5" colSpan={3}>
          {z1 ? "★ " : ""}
          {region} subtotal
        </td>
        <td className="px-3 py-1.5 text-right">{money(rt.spend)}</td>
        <td className="px-3 py-1.5 text-right">
          {ratio(rt.spend > 0 ? rt.revenue / rt.spend : 0)}
        </td>
        <td className="px-3 py-1.5 text-right">
          {money(rt.currentBudget)} → {money(rt.recommendedBudget)}
        </td>
        <td className={`px-3 py-1.5 text-right ${deltaClass(rt.budgetDelta)}`}>
          {signedMoney(rt.budgetDelta)}
        </td>
        <td className="px-3 py-1.5 text-right">{percent(rt.recommendedWeightPct)}</td>
      </tr>
    </>
  );
}
