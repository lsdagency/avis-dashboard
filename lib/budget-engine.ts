import { Z1_REGIONS } from "./types";
import type { BudgetRecommendation, CampaignSnapshot } from "./types";

/**
 * Budget reweighting logic. Called ONCE PER PLATFORM by the orchestrator — never
 * across platforms. Meta, Reddit and TikTok each keep their own budget pool,
 * Prospecting/Retargeting split, and guard rails.
 *
 * Design:
 *  1. Flexible Prospecting/Retargeting split with a 60% Prospecting floor.
 *  2. Cross-funnel ROAS normalisation (each campaign's ROAS divided by its stage
 *     average) so Retargeting's structurally higher ROAS doesn't drain Prospecting.
 *  3. Z1 region priority — GB/FR/ES/DE/IT get a 1.25× multiplier before normalisation.
 *  4. Guard rails — no campaign moves more than +100% / -50% in a single day.
 */

const ROAS_FLOOR = 0.1;
const PROSPECTING_MIN_SHARE = 0.6;
const Z1_MULTIPLIER = 1.25;
const MAX_INCREASE_FACTOR = 2.0;
const MIN_FACTOR = 0.5;

function effectiveRoas(snapshot: CampaignSnapshot): number {
  const base = Math.max(snapshot.roas, ROAS_FLOOR);
  // Z1_REGIONS uses normalised codes — 'GB' matches correctly because
  // parseCampaignName has already converted 'UK' → 'GB' before any snapshot
  // reaches this function.
  return base * (Z1_REGIONS.has(snapshot.region) ? Z1_MULTIPLIER : 1.0);
}

function normalisedScores(campaigns: CampaignSnapshot[]): Map<string, number> {
  if (campaigns.length === 0) return new Map();
  const scores = new Map(campaigns.map((s) => [s.campaignId, effectiveRoas(s)]));
  const avg = [...scores.values()].reduce((a, b) => a + b, 0) / scores.size;
  if (avg === 0) return scores;
  return new Map([...scores.entries()].map(([id, score]) => [id, score / avg]));
}

export function calculateRecommendations(
  snapshots: CampaignSnapshot[],
): BudgetRecommendation[] {
  if (!snapshots.length) return [];

  const totalBudget = snapshots.reduce((sum, s) => sum + s.currentBudget, 0);
  if (totalBudget === 0) return [];

  const upCampaigns = snapshots.filter((s) => s.funnelStage === "PROSPECTING");
  const lowCampaigns = snapshots.filter((s) => s.funnelStage === "RETARGETING");

  const upNorm = normalisedScores(upCampaigns);
  const lowNorm = normalisedScores(lowCampaigns);
  const allNorm = new Map([...upNorm, ...lowNorm]);
  const totalNorm = [...allNorm.values()].reduce((a, b) => a + b, 0) || 1;

  const unconstrained = new Map(
    [...allNorm.entries()].map(([id, s]) => [id, s / totalNorm]),
  );

  const upIds = new Set(upCampaigns.map((s) => s.campaignId));
  const upShare = [...unconstrained.entries()]
    .filter(([id]) => upIds.has(id))
    .reduce((sum, [, w]) => sum + w, 0);

  // Only apply the floor when there is a Prospecting pool to protect.
  const floorTriggered =
    upCampaigns.length > 0 && lowCampaigns.length > 0 && upShare < PROSPECTING_MIN_SHARE;

  const results: BudgetRecommendation[] = [];

  if (!floorTriggered) {
    for (const s of snapshots) {
      const weight = unconstrained.get(s.campaignId) ?? 0;
      results.push(buildResult(s, totalBudget * weight, totalBudget, false));
    }
  } else {
    const upPool = totalBudget * PROSPECTING_MIN_SHARE;
    const lowPool = totalBudget * (1 - PROSPECTING_MIN_SHARE);

    for (const [pool, budget, norm] of [
      [upCampaigns, upPool, upNorm],
      [lowCampaigns, lowPool, lowNorm],
    ] as const) {
      const poolTotal = [...norm.values()].reduce((a, b) => a + b, 0) || 1;
      for (const s of pool) {
        const weight = (norm.get(s.campaignId) ?? 0) / poolTotal;
        results.push(buildResult(s, budget * weight, totalBudget, true));
      }
    }
  }

  // Guard rails — clamp then renormalise back to the total pool.
  for (const r of results) {
    r.recommendedBudget = Math.max(
      r.currentBudget * MIN_FACTOR,
      Math.min(r.currentBudget * MAX_INCREASE_FACTOR, r.recommendedBudget),
    );
  }
  const clampedTotal = results.reduce((sum, r) => sum + r.recommendedBudget, 0) || 1;
  const scale = totalBudget / clampedTotal;
  for (const r of results) {
    r.recommendedBudget = Math.round(r.recommendedBudget * scale * 100) / 100;
    r.recommendedWeightPct =
      Math.round((r.recommendedBudget / totalBudget) * 10000) / 100;
    r.budgetDelta = Math.round((r.recommendedBudget - r.currentBudget) * 100) / 100;
  }

  return results.sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.funnelStage === "PROSPECTING" ? -1 : 1;
  });
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
