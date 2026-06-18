import { parseCampaignName } from "../types";
import type { CampaignSnapshot } from "../types";

/**
 * Live Reddit Ads fetch client (no SDK). OAuth2 client-credentials bearer token,
 * cached in memory for its lifetime; falls back to a long-lived REDDIT_ACCESS_TOKEN.
 * daily_budget_amount is micro-currency (millionths of GBP) — ÷1e6 for GBP.
 * Throws on missing credentials / API failure; pushRedditBudget never throws.
 */

const API_BASE = "https://ads-api.reddit.com/api/v3";
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

function isDummy(v?: string) {
  return !v || v.startsWith("dummy");
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(env: Record<string, string | undefined>): Promise<string> {
  if (!isDummy(env.REDDIT_ACCESS_TOKEN)) return env.REDDIT_ACCESS_TOKEN!;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const id = env.REDDIT_CLIENT_ID;
  const secret = env.REDDIT_CLIENT_SECRET;
  if (isDummy(id) || isDummy(secret)) {
    throw new Error("Reddit credentials not configured");
  }

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit token ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return tokenCache.token;
}

interface RedditCampaign {
  id: string;
  name: string;
  effective_status?: string;
  daily_budget_amount?: number;
}

export async function fetchRedditCampaigns(
  date: string,
  env: Record<string, string | undefined>,
): Promise<CampaignSnapshot[]> {
  const account = env.REDDIT_AD_ACCOUNT_ID;
  if (isDummy(account)) throw new Error("Reddit credentials not configured");
  const token = await getToken(env);

  const res = await fetch(`${API_BASE}/accounts/${account}/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Reddit campaigns ${res.status}`);
  const body = (await res.json()) as { data?: RedditCampaign[] };
  const campaigns = (body.data ?? []).filter(
    (c) =>
      !c.effective_status ||
      ["ACTIVE", "PAUSED"].includes(c.effective_status.toUpperCase()),
  );

  const snapshots: CampaignSnapshot[] = [];
  for (const c of campaigns) {
    const parsed = parseCampaignName(c.name);
    if (!parsed) continue;

    const currentBudget = c.daily_budget_amount
      ? c.daily_budget_amount / 1_000_000
      : 0;
    const { spend, revenue } = await fetchRedditInsights(
      account!,
      c.id,
      date,
      token,
    );
    const roas = spend > 0 ? revenue / spend : 0;

    snapshots.push({
      campaignId: c.id,
      campaignName: c.name,
      platform: "REDDIT",
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

async function fetchRedditInsights(
  account: string,
  campaignId: string,
  date: string,
  token: string,
): Promise<{ spend: number; revenue: number }> {
  const url =
    `${API_BASE}/accounts/${account}/campaigns/${campaignId}/reports/day` +
    `?start_time=${date}&end_time=${date}&fields=spend,conversions,conversion_value`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Reddit report ${res.status}`);
  const body = (await res.json()) as {
    data?: { spend?: number; conversion_value?: number }[];
  };
  const rows = body.data ?? [];
  const spend = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
  const revenue = rows.reduce((s, r) => s + (r.conversion_value ?? 0), 0);
  return { spend, revenue };
}

/** Push an updated daily budget (GBP) to a Reddit campaign. Never throws. */
export async function pushRedditBudget(
  campaignId: string,
  newBudgetGbp: number,
  env: Record<string, string | undefined>,
): Promise<{ success: boolean; error?: string }> {
  const account = env.REDDIT_AD_ACCOUNT_ID;
  if (isDummy(account)) return { success: false, error: "Reddit credentials not configured" };
  try {
    const token = await getToken(env);
    const res = await fetch(
      `${API_BASE}/accounts/${account}/campaigns/${campaignId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          daily_budget_amount: Math.round(newBudgetGbp * 1_000_000),
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Reddit ${res.status} ${text}`.trim() };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Reddit push failed" };
  }
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
