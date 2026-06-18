"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { DashboardData, UserRole } from "@/lib/types";
import DailySummaryCard from "@/components/dashboard/DailySummaryCard";
import SummaryCards from "@/components/dashboard/SummaryCards";
import PlatformStatusBadges from "@/components/dashboard/PlatformStatusBadges";
import CampaignTable from "@/components/dashboard/CampaignTable";
import RecommendationLegend from "@/components/dashboard/RecommendationLegend";
import PushBudgetsButton from "@/components/dashboard/PushBudgetsButton";
import Toast, { type ToastMessage } from "@/components/ui/Toast";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load");
    return r.json() as Promise<DashboardData>;
  });

export default function DashboardClient({
  initialData,
  role,
  date,
  historical,
}: {
  initialData: DashboardData;
  role: UserRole;
  date: string;
  historical: boolean;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, mutate } = useSWR<DashboardData>(
    `/api/metrics?date=${date}`,
    fetcher,
    {
      fallbackData: initialData,
      // Live "today" view auto-refreshes every 5 minutes; history is static.
      refreshInterval: historical ? 0 : 5 * 60 * 1000,
      revalidateOnFocus: !historical,
    },
  );

  const view = data ?? initialData;
  const usingSample = view.byPlatform.some((p) => p.usingSampleData);
  const lastUpdated = view.byPlatform
    .map((p) => p.lastUpdated)
    .sort()
    .slice(-1)[0];

  const onDateChange = useCallback(
    (next: string) => {
      if (!next) return;
      router.push(`/history?date=${next}`);
    },
    [router],
  );

  async function refreshNow() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/integrations/refresh?date=${date}`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setToast({ kind: "error", text: d.error || "Refresh failed" });
        return;
      }
      const fresh = (await res.json()) as DashboardData;
      await mutate(fresh, { revalidate: false });
      setToast({ kind: "success", text: "Pulled fresh data from all platforms." });
    } catch {
      setToast({ kind: "error", text: "Network error during refresh." });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-black/60">Date</label>
          <input
            type="date"
            defaultValue={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm outline-none focus:border-avis-red"
          />
          {historical && (
            <span className="rounded-full bg-avis-grey px-3 py-1 text-xs text-black/60">
              Historical view
            </span>
          )}
          {lastUpdated && (
            <span className="text-xs text-black/40">
              Last updated {new Date(lastUpdated).toLocaleString("en-GB")}
            </span>
          )}
        </div>

        {isAdmin && !historical && (
          <div className="flex items-center gap-3">
            <button
              onClick={refreshNow}
              disabled={refreshing}
              className="rounded-md border border-avis-red px-4 py-2 text-sm font-bold text-avis-red transition hover:bg-avis-red-soft disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "Refresh Now"}
            </button>
            <PushBudgetsButton
              date={date}
              campaignCount={view.recommendations.length}
              appliedToday={view.appliedToday}
              onToast={setToast}
              onApplied={() => mutate()}
            />
          </div>
        )}
      </div>

      {/* Sample data banner */}
      {usingSample && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Live data unavailable for{" "}
          <strong>
            {view.byPlatform
              .filter((p) => p.usingSampleData)
              .map((p) => p.platform)
              .join(", ")}
          </strong>{" "}
          — showing sample data.
          {lastUpdated &&
            ` Last successful pull: ${new Date(lastUpdated).toLocaleString("en-GB")}.`}
        </div>
      )}

      <DailySummaryCard summary={view.dailySummary} />
      <SummaryCards summary={view.summary} />
      <PlatformStatusBadges byPlatform={view.byPlatform} />
      <CampaignTable recommendations={view.recommendations} />
      <RecommendationLegend />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
