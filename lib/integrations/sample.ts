import { buildCampaignName, Z1_REGIONS } from "../types";
import type { CampaignSnapshot, FunnelStage, Platform } from "../types";

/**
 * Deterministic sample data so the dashboard is fully usable before any API
 * credential exists. Seeded by the date string, so numbers are stable on reload
 * but change daily. Covers a spread of European regions — Z1 (GB/FR/ES/DE/IT)
 * plus non-Z1 (AT, NL, BE, SE, NO, DK, CH, PL, PT, CZ).
 */

// Small seeded PRNG (mulberry32) — stable output for a given seed.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

interface Spec {
  region: string;
  funnel: FunnelStage;
}

// ROAS bands per platform & funnel: [min, max]. Z1 regions get a small uplift.
interface RoasProfile {
  prospecting: [number, number];
  retargeting: [number, number];
  z1Uplift: number; // multiplier applied to the band midpoint draw for Z1 regions
  baseBudget: [number, number]; // GBP daily-budget band for retargeting; prospecting scales up
}

const PROFILES: Record<Platform, RoasProfile> = {
  META: {
    prospecting: [1.0, 2.5],
    retargeting: [2.0, 4.0],
    z1Uplift: 1.12,
    baseBudget: [40, 120],
  },
  REDDIT: {
    prospecting: [0.8, 2.0],
    retargeting: [1.5, 3.0],
    z1Uplift: 1.1,
    baseBudget: [20, 70],
  },
  TIKTOK: {
    prospecting: [0.9, 2.0],
    retargeting: [1.8, 3.5],
    z1Uplift: 1.1,
    baseBudget: [30, 90],
  },
};

// Region/funnel composition per platform (~12 Meta, ~8 Reddit, ~7 TikTok).
const META_SPECS: Spec[] = [
  ...["GB", "FR", "ES", "DE", "IT", "AT"].flatMap((region) => [
    { region, funnel: "PROSPECTING" as FunnelStage },
    { region, funnel: "RETARGETING" as FunnelStage },
  ]),
];

const REDDIT_SPECS: Spec[] = [
  ...["GB", "FR", "NL", "SE"].flatMap((region) => [
    { region, funnel: "PROSPECTING" as FunnelStage },
    { region, funnel: "RETARGETING" as FunnelStage },
  ]),
];

const TIKTOK_SPECS: Spec[] = [
  { region: "GB", funnel: "PROSPECTING" },
  { region: "GB", funnel: "RETARGETING" },
  { region: "DE", funnel: "PROSPECTING" },
  { region: "DE", funnel: "RETARGETING" },
  { region: "PL", funnel: "PROSPECTING" },
  { region: "BE", funnel: "PROSPECTING" },
  { region: "PT", funnel: "RETARGETING" },
];

const SPECS: Record<Platform, Spec[]> = {
  META: META_SPECS,
  REDDIT: REDDIT_SPECS,
  TIKTOK: TIKTOK_SPECS,
};

function draw(r: () => number, [min, max]: [number, number]) {
  return min + r() * (max - min);
}

function generate(platform: Platform, date: string): CampaignSnapshot[] {
  const profile = PROFILES[platform];
  return SPECS[platform].map(({ region, funnel }) => {
    const campaignId = `${platform.toLowerCase()}-${region.toLowerCase()}-${
      funnel === "PROSPECTING" ? "up" : "low"
    }`;
    const r = rng(seedFromString(campaignId + date));

    const band = funnel === "PROSPECTING" ? profile.prospecting : profile.retargeting;
    let roas = draw(r, band);
    if (Z1_REGIONS.has(region)) roas *= profile.z1Uplift;
    roas = round(roas, 4);

    // Prospecting carries larger budgets (broader audiences) than retargeting.
    const budgetBand = profile.baseBudget;
    const funnelScale = funnel === "PROSPECTING" ? 1.6 : 1.0;
    const z1Scale = Z1_REGIONS.has(region) ? 1.25 : 1.0;
    const currentBudget =
      Math.round((draw(r, budgetBand) * funnelScale * z1Scale) / 5) * 5;

    // Daily spend lands within ~80–100% of the budget.
    const spend = round(currentBudget * (0.8 + r() * 0.2));
    const revenue = round(spend * roas);

    return {
      campaignId,
      campaignName: buildCampaignName(region, funnel),
      platform,
      region,
      funnelStage: funnel,
      spend,
      revenue,
      roas,
      currentBudget,
    };
  });
}

export function sampleMeta(date: string): CampaignSnapshot[] {
  return generate("META", date);
}
export function sampleReddit(date: string): CampaignSnapshot[] {
  return generate("REDDIT", date);
}
export function sampleTikTok(date: string): CampaignSnapshot[] {
  return generate("TIKTOK", date);
}

export function sampleForPlatform(platform: Platform, date: string): CampaignSnapshot[] {
  return generate(platform, date);
}
