import { parseCampaignName } from "../types";
import type { CampaignSnapshot } from "../types";

/**
 * Live Meta Ads fetch client (no SDK). Normalises Graph API responses into
 * CampaignSnapshot[]. Throws on missing credentials / API failure — the
 * orchestrator catches and falls back to sample data. pushBudget never throws.
 *
 * daily_budget is returned in pence — divided by 100 for GBP (and ×100 on write).
 */

const GRAPH = "https://graph.facebook.com/v19.0";

interface MetaEnv {
  META_ACCESS_TOKEN?: string;
  META_AD_ACCOUNT_ID?: string;
}

function isDummy(v?: string) {
  return !v || v.startsWith("dummy") || v === "act_000000000000";
}

interface MetaCampaign {
  id: string;
  name: string;
  daily_budget?: string;
  status?: string;
}

export async function fetchMetaCampaigns(
  date: string,
  env: Record<string, string | undefined>,
): Promise<CampaignSnapshot[]> {
  const token = env.META_ACCESS_TOKEN;
  const account = env.META_AD_ACCOUNT_ID;
  if (isDummy(token) || isDummy(account)) {
    throw new Error("Meta credentials not configured");
  }

  const filtering = encodeURIComponent(
    JSON.stringify([
      { field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] },
    ]),
  );
  const campaignsUrl =
    `${GRAPH}/${account}/campaigns` +
    `?fields=id,name,daily_budget,status&filtering=${filtering}` +
    `&limit=200&access_token=${encodeURIComponent(token!)}`;

  const res = await fetch(campaignsUrl);
  if (!res.ok) throw new Error(`Meta campaigns ${res.status}`);
  const body = (await res.json()) as { data?: MetaCampaign[] };
  const campaigns = body.data ?? [];

  const snapshots: CampaignSnapshot[] = [];
  for (const c of campaigns) {
    const parsed = parseCampaignName(c.name);
    if (!parsed) continue; // silently skip non-conventional names

    const currentBudget = c.daily_budget ? Number(c.daily_budget) / 100 : 0;
    const { spend, revenue } = await fetchMetaInsights(c.id, date, token!);
    const roas = spend > 0 ? revenue / spend : 0;

    snapshots.push({
      campaignId: c.id,
      campaignName: c.name,
      platform: "META",
      region: parsed.region,
      funnelStage: parsed.funnelStage,
      spend: round(spend),
      revenue: round(revenue),
      roas: round(roas, 4),
      currentBudget: round(currentBudget),
    });
  }
  return snapshots;
}

async function fetchMetaInsights(
  campaignId: string,
  date: string,
  token: string,
): Promise<{ spend: number; revenue: number }> {
  const timeRange = encodeURIComponent(JSON.stringify({ since: date, until: date }));
  const url =
    `${GRAPH}/${campaignId}/insights` +
    `?fields=spend,action_values&time_range=${timeRange}` +
    `&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta insights ${res.status}`);
  const body = (await res.json()) as {
    data?: { spend?: string; action_values?: { action_type: string; value: string }[] }[];
  };
  const row = body.data?.[0];
  const spend = row?.spend ? parseFloat(row.spend) : 0;
  const revenue =
    row?.action_values
      ?.filter((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")
      .reduce((sum, a) => sum + parseFloat(a.value || "0"), 0) ?? 0;
  return { spend, revenue };
}

/** Push an updated daily budget (GBP) to a Meta campaign. Never throws. */
export async function pushMetaBudget(
  campaignId: string,
  newBudgetGbp: number,
  env: Record<string, string | undefined>,
): Promise<{ success: boolean; error?: string }> {
  const token = env.META_ACCESS_TOKEN;
  if (isDummy(token)) return { success: false, error: "Meta credentials not configured" };
  try {
    const res = await fetch(`${GRAPH}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_budget: Math.round(newBudgetGbp * 100),
        access_token: token,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Meta ${res.status} ${text}`.trim() };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Meta push failed" };
  }
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
