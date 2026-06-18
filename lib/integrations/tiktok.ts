import { parseCampaignName } from "../types";
import type { CampaignSnapshot } from "../types";

/**
 * Live TikTok Ads fetch client (no SDK). Long-lived token passed as the
 * Access-Token header. budget is GBP (float). Throws on missing credentials /
 * API failure; pushTikTokBudget never throws.
 */

const API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

function isDummy(v?: string) {
  return !v || v.startsWith("dummy");
}

interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  budget?: number;
  primary_status?: string;
  status?: string;
}

export async function fetchTikTokCampaigns(
  date: string,
  env: Record<string, string | undefined>,
): Promise<CampaignSnapshot[]> {
  const token = env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = env.TIKTOK_ADVERTISER_ID;
  if (isDummy(token) || isDummy(advertiserId)) {
    throw new Error("TikTok credentials not configured");
  }

  const fields = encodeURIComponent(
    JSON.stringify(["campaign_id", "campaign_name", "budget", "primary_status"]),
  );
  const url =
    `${API_BASE}/campaign/get/` +
    `?advertiser_id=${encodeURIComponent(advertiserId!)}&fields=${fields}&page_size=200`;
  const res = await fetch(url, { headers: { "Access-Token": token! } });
  if (!res.ok) throw new Error(`TikTok campaigns ${res.status}`);
  const body = (await res.json()) as {
    data?: { list?: TikTokCampaign[] };
  };
  const campaigns = (body.data?.list ?? []).filter((c) => {
    const status = (c.primary_status ?? c.status ?? "").toUpperCase();
    return (
      !status ||
      status === "CAMPAIGN_STATUS_ENABLE" ||
      status === "CAMPAIGN_STATUS_DISABLE"
    );
  });

  const snapshots: CampaignSnapshot[] = [];
  for (const c of campaigns) {
    const parsed = parseCampaignName(c.campaign_name);
    if (!parsed) continue;

    const currentBudget = c.budget ?? 0;
    const { spend, revenue } = await fetchTikTokInsights(
      advertiserId!,
      c.campaign_id,
      date,
      token!,
    );
    const roas = spend > 0 ? revenue / spend : 0;

    snapshots.push({
      campaignId: c.campaign_id,
      campaignName: c.campaign_name,
      platform: "TIKTOK",
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

async function fetchTikTokInsights(
  advertiserId: string,
  campaignId: string,
  date: string,
  token: string,
): Promise<{ spend: number; revenue: number }> {
  const res = await fetch(`${API_BASE}/report/integrated/get/`, {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id", "stat_time_day"],
      metrics: ["spend", "total_purchase_value", "campaign_name"],
      start_date: date,
      end_date: date,
      filters: [
        {
          field_name: "campaign_ids",
          filter_type: "IN",
          filter_value: JSON.stringify([campaignId]),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`TikTok report ${res.status}`);
  const body = (await res.json()) as {
    data?: { list?: { metrics?: { spend?: string; total_purchase_value?: string } }[] };
  };
  const rows = body.data?.list ?? [];
  const spend = rows.reduce(
    (s, r) => s + parseFloat(r.metrics?.spend ?? "0"),
    0,
  );
  const revenue = rows.reduce(
    (s, r) => s + parseFloat(r.metrics?.total_purchase_value ?? "0"),
    0,
  );
  return { spend, revenue };
}

/** Push an updated daily budget (GBP) to a TikTok campaign. Never throws. */
export async function pushTikTokBudget(
  campaignId: string,
  newBudgetGbp: number,
  env: Record<string, string | undefined>,
): Promise<{ success: boolean; error?: string }> {
  const token = env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = env.TIKTOK_ADVERTISER_ID;
  if (isDummy(token) || isDummy(advertiserId)) {
    return { success: false, error: "TikTok credentials not configured" };
  }
  try {
    const res = await fetch(`${API_BASE}/campaign/update/`, {
      method: "POST",
      headers: { "Access-Token": token!, "Content-Type": "application/json" },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_id: campaignId,
        budget: newBudgetGbp,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `TikTok ${res.status} ${text}`.trim() };
    }
    const body = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
    if (body.code !== undefined && body.code !== 0) {
      return { success: false, error: body.message || `TikTok code ${body.code}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "TikTok push failed" };
  }
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
