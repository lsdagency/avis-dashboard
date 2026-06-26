import { and, eq, sql } from "drizzle-orm";
import { db, dbAvailable, schema } from "../db";
import { resolveEnv } from "../credentials";
import { calculateRecommendations } from "../budget-engine";
import { getProspectingFloor, getZ1Multiplier } from "../settings";
import {
  PLATFORMS,
  type BudgetRecommendation,
  type CampaignSnapshot,
  type DashboardData,
  type DashboardSummary,
  type Platform,
  type PlatformSummary,
} from "../types";
import { fetchMetaCampaigns, pushMetaBudget } from "./meta";
import { fetchRedditCampaigns, pushRedditBudget } from "./reddit";
import { fetchTikTokCampaigns, pushTikTokBudget } from "./tiktok";
import { sampleForPlatform } from "./sample";

export * from "../types";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Today's date (YYYY-MM-DD) in a given IANA timezone. */
export function todayInTz(tz = process.env.APP_TIMEZONE || "Europe/London"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function parseDate(param?: string | null): string {
  if (param && ISO_DATE.test(param)) return param;
  return todayInTz();
}

const LIVE_FETCHERS: Record<
  Platform,
  (date: string, env: Record<string, string | undefined>) => Promise<CampaignSnapshot[]>
> = {
  META: fetchMetaCampaigns,
  REDDIT: fetchRedditCampaigns,
  TIKTOK: fetchTikTokCampaigns,
};

const PUSHERS: Record<
  Platform,
  (
    campaignId: string,
    budget: number,
    env: Record<string, string | undefined>,
  ) => Promise<{ success: boolean; error?: string }>
> = {
  META: pushMetaBudget,
  REDDIT: pushRedditBudget,
  TIKTOK: pushTikTokBudget,
};

interface PlatformResult {
  platform: Platform;
  snapshots: CampaignSnapshot[];
  usingSampleData: boolean;
  error?: string;
  lastUpdated: string;
}

// ---- per-platform cache of LIVE results (sample data is never cached) ----
async function cachedLive(
  platform: Platform,
  date: string,
  env: Record<string, string | undefined>,
  refresh: boolean,
): Promise<CampaignSnapshot[]> {
  const key = `${platform.toLowerCase()}_campaigns_${date}`;

  if (!refresh && dbAvailable && db) {
    const rows = await db
      .select()
      .from(schema.apiCache)
      .where(eq(schema.apiCache.key, key))
      .limit(1);
    const row = rows[0];
    if (row && new Date(row.expiresAt).getTime() > Date.now()) {
      return row.data as CampaignSnapshot[];
    }
  }

  const snapshots = await LIVE_FETCHERS[platform](date, env);

  if (dbAvailable && db) {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await db
      .insert(schema.apiCache)
      .values({ key, data: snapshots, expiresAt })
      .onConflictDoUpdate({
        target: schema.apiCache.key,
        set: { data: snapshots, cachedAt: sql`now()`, expiresAt },
      });
  }
  return snapshots;
}

/**
 * Run all three platform pulls in parallel. Each platform independently falls
 * back to sample data + a non-fatal error on failure — one broken integration
 * never blanks the others.
 */
export async function fetchAllPlatforms(
  date: string,
  env: Record<string, string | undefined>,
  refresh = false,
): Promise<PlatformResult[]> {
  const settled = await Promise.allSettled(
    PLATFORMS.map((p) => cachedLive(p, date, env, refresh)),
  );

  return PLATFORMS.map((platform, i) => {
    const result = settled[i];
    const lastUpdated = new Date().toISOString();
    if (result.status === "fulfilled" && result.value.length > 0) {
      return { platform, snapshots: result.value, usingSampleData: false, lastUpdated };
    }
    const error =
      result.status === "rejected"
        ? result.reason instanceof Error
          ? result.reason.message
          : String(result.reason)
        : "No live campaigns returned";
    return {
      platform,
      snapshots: sampleForPlatform(platform, date),
      usingSampleData: true,
      error,
      lastUpdated,
    };
  });
}

function summarise(
  platform: Platform,
  recs: BudgetRecommendation[],
  meta: PlatformResult,
): PlatformSummary {
  const totalSpend = round(recs.reduce((a, r) => a + r.spend, 0));
  const totalRevenue = round(recs.reduce((a, r) => a + r.revenue, 0));
  const totalCurrentBudget = round(recs.reduce((a, r) => a + r.currentBudget, 0));
  const totalRecommendedBudget = round(
    recs.reduce((a, r) => a + r.recommendedBudget, 0),
  );
  const prospectingBudget = recs
    .filter((r) => r.funnelStage === "PROSPECTING")
    .reduce((a, r) => a + r.recommendedBudget, 0);
  return {
    platform,
    totalSpend,
    totalRevenue,
    blendedRoas: totalSpend > 0 ? round(totalRevenue / totalSpend, 4) : 0,
    totalCurrentBudget,
    totalRecommendedBudget,
    prospectingSplitPct:
      totalRecommendedBudget > 0
        ? round((prospectingBudget / totalRecommendedBudget) * 100)
        : 0,
    floorTriggered: recs.some((r) => r.floorTriggered),
    lastUpdated: meta.lastUpdated,
    usingSampleData: meta.usingSampleData,
    error: meta.error,
  };
}

function rollup(byPlatform: PlatformSummary[]): DashboardSummary {
  const totalSpend = round(byPlatform.reduce((a, p) => a + p.totalSpend, 0));
  const totalRevenue = round(byPlatform.reduce((a, p) => a + p.totalRevenue, 0));
  const totalCurrentBudget = round(
    byPlatform.reduce((a, p) => a + p.totalCurrentBudget, 0),
  );
  const totalRecommendedBudget = round(
    byPlatform.reduce((a, p) => a + p.totalRecommendedBudget, 0),
  );
  // Weighted-average prospecting split, weighted by each platform's budget pool.
  const weightedProspecting = byPlatform.reduce(
    (a, p) => a + (p.prospectingSplitPct / 100) * p.totalRecommendedBudget,
    0,
  );
  return {
    totalSpend,
    totalRevenue,
    blendedRoas: totalSpend > 0 ? round(totalRevenue / totalSpend, 4) : 0,
    totalCurrentBudget,
    totalRecommendedBudget,
    prospectingSplitPct:
      totalRecommendedBudget > 0
        ? round((weightedProspecting / totalRecommendedBudget) * 100)
        : 0,
    byPlatform,
  };
}

/** Compute recommendations + summaries for a date. Per-platform isolation. */
async function compute(
  date: string,
  env: Record<string, string | undefined>,
  refresh: boolean,
): Promise<{
  recommendations: BudgetRecommendation[];
  byPlatform: PlatformSummary[];
  summary: DashboardSummary;
}> {
  const [results, prospectingFloor, z1Multiplier] = await Promise.all([
    fetchAllPlatforms(date, env, refresh),
    getProspectingFloor(),
    getZ1Multiplier(),
  ]);
  const recommendations: BudgetRecommendation[] = [];
  const byPlatform: PlatformSummary[] = [];

  for (const meta of results) {
    // calculateRecommendations is called ONCE PER PLATFORM — never across them.
    const recs = calculateRecommendations(meta.snapshots, {
      prospectingFloor,
      z1Multiplier,
    });
    recommendations.push(...recs);
    byPlatform.push(summarise(meta.platform, recs, meta));
  }

  return { recommendations, byPlatform, summary: rollup(byPlatform) };
}

/** Whether any recommendation for this date has been applied. */
async function appliedToday(date: string): Promise<boolean> {
  if (!dbAvailable || !db) return false;
  const rows = await db
    .select({ id: schema.budgetRecommendations.id })
    .from(schema.budgetRecommendations)
    .where(
      and(
        eq(schema.budgetRecommendations.recommendationDate, date),
        eq(schema.budgetRecommendations.applied, true),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Persist snapshots + recommendations (preserves the applied flag on conflict). */
async function persist(date: string, recs: BudgetRecommendation[]) {
  if (!dbAvailable || !db || !recs.length) return;

  await db
    .insert(schema.campaignSnapshots)
    .values(
      recs.map((r) => ({
        snapshotDate: date,
        platform: r.platform,
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        region: r.region,
        funnelStage: r.funnelStage,
        spend: String(r.spend),
        revenue: String(r.revenue),
        roas: String(r.roas),
        currentBudget: String(r.currentBudget),
      })),
    )
    .onConflictDoUpdate({
      target: [
        schema.campaignSnapshots.snapshotDate,
        schema.campaignSnapshots.platform,
        schema.campaignSnapshots.campaignId,
      ],
      set: {
        spend: sql`excluded.spend`,
        revenue: sql`excluded.revenue`,
        roas: sql`excluded.roas`,
        currentBudget: sql`excluded.current_budget`,
      },
    });

  await db
    .insert(schema.budgetRecommendations)
    .values(
      recs.map((r) => ({
        recommendationDate: date,
        platform: r.platform,
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        region: r.region,
        funnelStage: r.funnelStage,
        spend: String(r.spend),
        revenue: String(r.revenue),
        roas: String(r.roas),
        currentBudget: String(r.currentBudget),
        currentWeightPct: String(r.currentWeightPct),
        recommendedBudget: String(r.recommendedBudget),
        recommendedWeightPct: String(r.recommendedWeightPct),
        budgetDelta: String(r.budgetDelta),
        floorTriggered: r.floorTriggered,
        z1Boosted: r.z1Boosted,
      })),
    )
    .onConflictDoUpdate({
      target: [
        schema.budgetRecommendations.recommendationDate,
        schema.budgetRecommendations.platform,
        schema.budgetRecommendations.campaignId,
      ],
      // Note: `applied` / `appliedAt` are intentionally NOT updated here.
      set: {
        spend: sql`excluded.spend`,
        revenue: sql`excluded.revenue`,
        roas: sql`excluded.roas`,
        currentBudget: sql`excluded.current_budget`,
        currentWeightPct: sql`excluded.current_weight_pct`,
        recommendedBudget: sql`excluded.recommended_budget`,
        recommendedWeightPct: sql`excluded.recommended_weight_pct`,
        budgetDelta: sql`excluded.budget_delta`,
        floorTriggered: sql`excluded.floor_triggered`,
        z1Boosted: sql`excluded.z1_boosted`,
      },
    });
}

/**
 * Full dashboard payload for a date. Always works — sample data fills any
 * platform without live credentials.
 */
export async function getDashboardData(
  date: string,
  opts: { refresh?: boolean } = {},
): Promise<DashboardData> {
  const refresh = opts.refresh ?? false;
  const env = await resolveEnv();
  const { recommendations, byPlatform, summary } = await compute(date, env, refresh);

  if (refresh) await persist(date, recommendations);

  return {
    date,
    generatedAt: new Date().toISOString(),
    currency: "GBP",
    recommendations,
    byPlatform,
    summary,
    appliedToday: await appliedToday(date),
  };
}

export interface PushOutcome {
  applied: number;
  failed: number;
  errors: string[];
  byPlatform: { platform: Platform; applied: number; failed: number }[];
}

/**
 * Push today's recommended budgets to each platform's API and mark applied.
 * Skips any campaign whose recommended budget is ≤ £0 after guard rails.
 */
export async function pushBudgets(
  date: string,
  env: Record<string, string | undefined>,
): Promise<PushOutcome> {
  const { recommendations } = await compute(date, env, true);
  await persist(date, recommendations);

  const errors: string[] = [];
  const perPlatform = new Map<Platform, { applied: number; failed: number }>();
  for (const p of PLATFORMS) perPlatform.set(p, { applied: 0, failed: 0 });

  const appliedIds: { platform: Platform; campaignId: string }[] = [];

  for (const r of recommendations) {
    if (r.recommendedBudget <= 0) {
      errors.push(`${r.platform} ${r.campaignName}: recommended budget ≤ £0 — skipped`);
      continue;
    }
    const outcome = await PUSHERS[r.platform](r.campaignId, r.recommendedBudget, env);
    const bucket = perPlatform.get(r.platform)!;
    if (outcome.success) {
      bucket.applied++;
      appliedIds.push({ platform: r.platform, campaignId: r.campaignId });
    } else {
      bucket.failed++;
      if (outcome.error) errors.push(`${r.platform} ${r.campaignName}: ${outcome.error}`);
    }
  }

  // Mark the successfully-pushed recommendations as applied.
  if (dbAvailable && db && appliedIds.length) {
    for (const { platform, campaignId } of appliedIds) {
      await db
        .update(schema.budgetRecommendations)
        .set({ applied: true, appliedAt: new Date() })
        .where(
          and(
            eq(schema.budgetRecommendations.recommendationDate, date),
            eq(schema.budgetRecommendations.platform, platform),
            eq(schema.budgetRecommendations.campaignId, campaignId),
          ),
        );
    }
  }

  let applied = 0;
  let failed = 0;
  const byPlatform = PLATFORMS.map((platform) => {
    const b = perPlatform.get(platform)!;
    applied += b.applied;
    failed += b.failed;
    return { platform, applied: b.applied, failed: b.failed };
  });

  return { applied, failed, errors, byPlatform };
}

/** Refresh: pull all platforms, recompute, persist. */
export async function runRefresh(date: string): Promise<DashboardData> {
  return getDashboardData(date, { refresh: true });
}
