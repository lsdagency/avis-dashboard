/**
 * Shared normalised types. The UI and budget engine only ever consume these —
 * never raw Meta / Reddit / TikTok payloads. Each platform client normalises its
 * response into these shapes, so swapping or mocking a provider only touches its
 * own client file.
 */

export type FunnelStage = "PROSPECTING" | "RETARGETING";
export type Platform = "META" | "REDDIT" | "TIKTOK";
export type UserRole = "admin" | "client";

export const PLATFORMS: Platform[] = ["META", "REDDIT", "TIKTOK"];

// Region is a free-form ISO 3166-1 alpha-2 country code (e.g. 'GB', 'FR', 'DE').
// There is no fixed enum — any country code parsed from a campaign name is valid.
// The one normalisation exception: campaigns use 'UK' in their name, which must be
// stored and displayed as 'GB' throughout the app.
export type Region = string;

// The five Z1 priority regions (stored as normalised codes).
export const Z1_REGIONS = new Set<Region>(["GB", "FR", "ES", "DE", "IT"]);

export interface CampaignSnapshot {
  campaignId: string;
  campaignName: string;
  platform: Platform;
  region: Region; // normalised ISO code — 'UK' → 'GB'
  funnelStage: FunnelStage;
  spend: number; // GBP
  revenue: number; // GBP purchase value
  roas: number;
  currentBudget: number; // GBP daily budget
}

export interface BudgetRecommendation extends CampaignSnapshot {
  currentWeightPct: number; // % of platform budget pool (0–100)
  recommendedBudget: number;
  recommendedWeightPct: number;
  budgetDelta: number; // recommended - current
  floorTriggered: boolean; // true if the 60% Prospecting floor was applied
  z1Boosted: boolean; // true if the Z1 multiplier was applied
}

// Per-platform summary (three of these shown on the dashboard).
export interface PlatformSummary {
  platform: Platform;
  totalSpend: number;
  totalRevenue: number;
  blendedRoas: number;
  totalCurrentBudget: number;
  totalRecommendedBudget: number;
  prospectingSplitPct: number;
  floorTriggered: boolean;
  lastUpdated: string; // ISO timestamp
  usingSampleData: boolean;
  error?: string; // non-fatal — shown in the per-platform warning banner
}

// Rolled-up summary across all platforms for the top-level summary cards.
export interface DashboardSummary {
  totalSpend: number;
  totalRevenue: number;
  blendedRoas: number;
  totalCurrentBudget: number;
  totalRecommendedBudget: number;
  prospectingSplitPct: number; // weighted average across platforms
  byPlatform: PlatformSummary[];
}

export interface PlatformApiStatus {
  platform: Platform;
  connected: boolean;
  error?: string;
}

// Monthly budget pacing — tracks run rate so the month never overspends.
export interface PacingSummary {
  active: boolean; // true once a monthly budget is set
  monthlyBudget: number;
  monthLabel: string; // e.g. "June 2026"
  daysInMonth: number;
  dayOfMonth: number;
  daysRemaining: number; // including today
  mtdSpend: number; // spend on completed days this month (excludes today)
  mtdSource: "stored" | "override" | "estimated";
  remaining: number; // monthlyBudget - mtdSpend
  evenDailyPace: number; // remaining / daysRemaining
  stancePct: number; // -50 (hold back) … 0 (even) … +50 (push now)
  recommendedDailyPool: number; // today's target total spend (what recs sum to)
  currentDailyRunRate: number; // sum of current daily budgets
  projectedMonthEndSpend: number; // mtd + currentRunRate × daysRemaining
  status: "ahead" | "behind" | "on_track"; // current run rate vs even pace
}

// The full payload the dashboard consumes for a given date.
export interface DashboardData {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO timestamp
  currency: string;
  recommendations: BudgetRecommendation[];
  byPlatform: PlatformSummary[];
  summary: DashboardSummary;
  pacing: PacingSummary;
  appliedToday: boolean;
}

// ─────────────────────────────────────────────────────────────
// Campaign naming convention & parsing
//
//   ABG16785 - AVIS - [REGION] - SALES - [FUNNEL] - BAU - 2026
//
// Shared by all three platform clients. Any name that does not match is skipped.
// ─────────────────────────────────────────────────────────────

const REGION_NORMALIZER: Record<string, string> = {
  UK: "GB", // Campaigns use 'UK'; normalise to ISO 3166-1 'GB' throughout.
  // All other codes pass through unchanged.
};

const FUNNEL_MAP: Record<string, FunnelStage> = {
  UP: "PROSPECTING",
  LOW: "RETARGETING",
};

// Matches the standard Avis campaign naming pattern.
const CAMPAIGN_PATTERN =
  /ABG16785\s*-\s*AVIS\s*-\s*([A-Z]{2,4})\s*-\s*SALES\s*-\s*(UP|LOW)\s*-\s*BAU/i;

export function parseCampaignName(
  name: string,
): { region: Region; funnelStage: FunnelStage } | null {
  const match = name.match(CAMPAIGN_PATTERN);
  if (!match) return null;

  const rawRegion = match[1].toUpperCase();
  const region = REGION_NORMALIZER[rawRegion] ?? rawRegion; // normalise UK→GB; pass rest through
  const funnelStage = FUNNEL_MAP[match[2].toUpperCase()];

  if (!funnelStage) return null;
  return { region, funnelStage };
}

/** Build a conventional Avis campaign name (used by the sample-data generators). */
export function buildCampaignName(region: Region, funnelStage: FunnelStage): string {
  const funnel = funnelStage === "PROSPECTING" ? "UP" : "LOW";
  // Sample data mirrors real Meta campaigns, which use 'UK' (normalised to GB on parse).
  const displayRegion = region === "GB" ? "UK" : region;
  return `ABG16785 - AVIS - ${displayRegion} - SALES - ${funnel} - BAU - 2026`;
}
