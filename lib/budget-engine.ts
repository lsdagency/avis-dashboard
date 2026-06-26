import { Z1_REGIONS } from "./types";
import type { BudgetRecommendation, CampaignSnapshot, FunnelStage } from "./types";
import { DEFAULT_PROSPECTING_FLOOR, DEFAULT_Z1_MULTIPLIER } from "./settings";

/**
 * Performance-anchored budget reweighting. Called ONCE PER PLATFORM by the
 * orchestrator — never across platforms. Each platform keeps its own pool.
 *
 * Model:
 *  1. Effective ROAS = max(roas, 0.1) × (Z1 ? 1.25 : 1).
 *  2. Within each funnel stage, a campaign's budget is its CURRENT budget scaled
 *     by a performance multiplier: clamp((effRoas / funnelAvg)^GAMMA, 0.5, 2.0).
 *     So the best regions in a funnel get the biggest increases and weak ones get
 *     cut — anchored to current spend, not to an abstract "fair share".
 *  3. Funnel pool split follows the CURRENT split, with Prospecting lifted to the
 *     configurable floor (default 50%) when it would otherwise fall below it.
 *  4. Guard rails: no campaign moves more than +100% / −50% in a day. Enforced
 *     strictly via iterative water-filling that keeps the platform total constant.
 *
 * Cross-funnel ROAS is normalised by funnel average (step 2), so Retargeting's
 * structurally higher ROAS never auto-drains Prospecting.
 */

const ROAS_FLOOR = 0.1;
const MAX_INCREASE_FACTOR = 2.0; // +100%
const MIN_FACTOR = 0.5; // −50%
const GAMMA = 1.5; // balanced tilt toward best performers

export interface EngineOptions {
  /** Prospecting minimum share of the pool (0–1). Default 0.5. */
  prospectingFloor?: number;
  /** ROAS multiplier for Z1 priority regions. Default 1.25; 1.0 = off. */
  z1Multiplier?: number;
  /**
   * Total daily budget to allocate today (from monthly pacing). When omitted, the
   * pool stays equal to the current daily budgets (pure reallocation). When set,
   * the recommendations sum to this value — guard rails still bound per-campaign
   * moves, but an extreme pacing target overrides them so the pool is hit exactly.
   */
  targetPool?: number;
}

function effectiveRoas(s: CampaignSnapshot, z1Multiplier: number): number {
  const base = Math.max(s.roas, ROAS_FLOOR);
  return base * (Z1_REGIONS.has(s.region) ? z1Multiplier : 1.0);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function calculateRecommendations(
  snapshots: CampaignSnapshot[],
  opts: EngineOptions = {},
): BudgetRecommendation[] {
  if (!snapshots.length) return [];

  const totalBudget = snapshots.reduce((sum, s) => sum + s.currentBudget, 0);
  if (totalBudget === 0) return [];

  const floor = clamp(opts.prospectingFloor ?? DEFAULT_PROSPECTING_FLOOR, 0, 0.9);
  const z1 = clamp(opts.z1Multiplier ?? DEFAULT_Z1_MULTIPLIER, 1, 2);
  // Pacing can set the total pool for today; otherwise keep the current total.
  const pool =
    opts.targetPool != null && opts.targetPool >= 0 ? opts.targetPool : totalBudget;

  const up = snapshots.filter((s) => s.funnelStage === "PROSPECTING");
  const low = snapshots.filter((s) => s.funnelStage === "RETARGETING");

  // ── Funnel pool split: current split, with Prospecting lifted to the floor ──
  const upCurrent = up.reduce((a, s) => a + s.currentBudget, 0);
  const upShareCurrent = upCurrent / totalBudget;
  let upPoolShare: number;
  if (up.length && low.length) {
    upPoolShare = Math.max(upShareCurrent, floor);
  } else {
    upPoolShare = up.length ? 1 : 0;
  }
  const floorTriggered =
    up.length > 0 && low.length > 0 && upShareCurrent < floor;
  const upPool = pool * upPoolShare;
  const lowPool = pool - upPool;

  // ── Within-funnel performance-anchored allocation ──
  const results: BudgetRecommendation[] = [];
  for (const [campaigns, poolBudget] of [
    [up, upPool],
    [low, lowPool],
  ] as const) {
    if (!campaigns.length) continue;
    const avgEff =
      campaigns.reduce((a, s) => a + effectiveRoas(s, z1), 0) / campaigns.length || 1;

    const weights = campaigns.map((s) => {
      const rel = avgEff > 0 ? effectiveRoas(s, z1) / avgEff : 1;
      const multiplier = clamp(Math.pow(rel, GAMMA), MIN_FACTOR, MAX_INCREASE_FACTOR);
      return s.currentBudget * multiplier;
    });
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;

    campaigns.forEach((s, i) => {
      const target = poolBudget * (weights[i] / wsum);
      results.push(buildResult(s, target, totalBudget, floorTriggered));
    });
  }

  // ── Guard rails: clamp to ±, keep the pool constant ──
  settle(results, pool);

  // If the pacing target sits outside the guard-rail band (an extreme ramp or
  // cut), settle can't reach it — scale proportionally so the pool is hit exactly.
  // The monthly cap is a hard constraint and takes precedence over the ± rails.
  const settled = results.reduce((a, r) => a + r.recommendedBudget, 0);
  if (settled > 0 && Math.abs(settled - pool) > 0.01) {
    const k = pool / settled;
    for (const r of results) r.recommendedBudget *= k;
  }

  for (const r of results) {
    r.recommendedBudget = Math.round(r.recommendedBudget * 100) / 100;
    r.recommendedWeightPct =
      pool > 0 ? Math.round((r.recommendedBudget / pool) * 10000) / 100 : 0;
    r.budgetDelta = Math.round((r.recommendedBudget - r.currentBudget) * 100) / 100;
  }

  return results.sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.funnelStage === "PROSPECTING" ? -1 : 1;
  });
}

/**
 * Iterative water-filling: clamp every campaign to [0.5×, 2×] its current budget,
 * then redistribute any residual across campaigns that still have headroom — so
 * the recommended budgets sum to the platform total without breaching a guard rail.
 * Always converges because the current budgets (which sum to total) sit inside the
 * feasible band.
 */
function settle(results: BudgetRecommendation[], total: number) {
  for (let iter = 0; iter < 30; iter++) {
    let sum = 0;
    for (const r of results) {
      const lo = r.currentBudget * MIN_FACTOR;
      const hi = r.currentBudget * MAX_INCREASE_FACTOR;
      r.recommendedBudget = clamp(r.recommendedBudget, lo, hi);
      sum += r.recommendedBudget;
    }
    const diff = total - sum;
    if (Math.abs(diff) < 0.005) break;

    const adjustable = results.filter((r) =>
      diff > 0
        ? r.recommendedBudget < r.currentBudget * MAX_INCREASE_FACTOR - 1e-9
        : r.recommendedBudget > r.currentBudget * MIN_FACTOR + 1e-9,
    );
    const base = adjustable.reduce((a, r) => a + r.currentBudget, 0);
    if (base <= 0) break;
    for (const r of adjustable) {
      r.recommendedBudget += diff * (r.currentBudget / base);
    }
  }
}

function buildResult(
  s: CampaignSnapshot,
  recommendedBudget: number,
  totalBudget: number,
  floorTriggered: boolean,
): BudgetRecommendation {
  return {
    ...s,
    currentWeightPct: Math.round((s.currentBudget / totalBudget) * 10000) / 100,
    recommendedBudget,
    recommendedWeightPct: 0, // set after guard rails
    budgetDelta: 0, // set after guard rails
    floorTriggered,
    z1Boosted: Z1_REGIONS.has(s.region),
  };
}

// Re-exported for callers that want the stage list without importing types twice.
export type { FunnelStage };
