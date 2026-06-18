import Anthropic from "@anthropic-ai/sdk";
import type {
  BudgetRecommendation,
  BudgetSummary,
  PlatformSummary,
} from "./types";
import { money, ratio } from "./format";

/**
 * Plain-English daily budget summary for the top of the dashboard. Uses Claude
 * with forced tool use for structured output; falls back to a deterministic
 * heuristic when ANTHROPIC_API_KEY is absent or the call fails. Always works.
 */

interface SummaryShape {
  headline: string;
  topPerformer: string;
  floorNote: string;
  recommendation: string;
}

export function heuristicSummary(
  recommendations: BudgetRecommendation[],
  byPlatform: PlatformSummary[],
): BudgetSummary {
  const shape = buildHeuristic(recommendations, byPlatform);
  return { ...shape, generatedBy: "heuristic" };
}

function buildHeuristic(
  recommendations: BudgetRecommendation[],
  byPlatform: PlatformSummary[],
): SummaryShape {
  const totalSpend = byPlatform.reduce((a, p) => a + p.totalSpend, 0);
  const totalRevenue = byPlatform.reduce((a, p) => a + p.totalRevenue, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const top = [...recommendations].sort((a, b) => b.roas - a.roas)[0];
  const biggestMove = [...recommendations].sort(
    (a, b) => Math.abs(b.budgetDelta) - Math.abs(a.budgetDelta),
  )[0];
  const flooredPlatforms = byPlatform.filter((p) => p.floorTriggered);

  const headline = `Across ${byPlatform.length} platforms, ${money(
    totalSpend,
  )} spent at a blended ${ratio(blendedRoas)} ROAS — budgets rebalanced within each channel's pool.`;

  const topPerformer = top
    ? `${top.region} ${top.funnelStage.toLowerCase()} on ${top.platform} leads at ${ratio(
        top.roas,
      )} ROAS${top.z1Boosted ? " (Z1 priority region)" : ""}.`
    : "No campaign data available.";

  const floorNote = flooredPlatforms.length
    ? `60% Prospecting floor active on ${flooredPlatforms
        .map((p) => p.platform)
        .join(", ")}.`
    : "";

  const recommendation = biggestMove
    ? `Largest shift: ${biggestMove.region} ${biggestMove.funnelStage.toLowerCase()} on ${
        biggestMove.platform
      } ${biggestMove.budgetDelta >= 0 ? "up" : "down"} ${money(
        Math.abs(biggestMove.budgetDelta),
      )}/day. Review and push when ready.`
    : "No budget changes recommended today.";

  return { headline, topPerformer, floorNote, recommendation };
}

const SYSTEM = `You are a senior paid-media strategist reporting on Avis Budget Group's daily cross-platform ad performance (Meta, Reddit, TikTok). All money is GBP (£). Budgets are reweighted within each platform's own pool — never across platforms — using ROAS performance with a 60% Prospecting floor and a 1.25× multiplier for Z1 priority regions (GB, FR, ES, DE, IT). Be concise, specific and number-driven. Write for a client audience.`;

const TOOL: Anthropic.Tool = {
  name: "budget_summary",
  description: "Structured daily budget recommendation summary.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "1 sentence summary of the day's recommendations." },
      topPerformer: { type: "string", description: "The single best performing campaign and why." },
      floorNote: { type: "string", description: "Note if the 60% Prospecting floor was triggered, or empty string." },
      recommendation: { type: "string", description: "1–2 sentence action guidance for the team." },
    },
    required: ["headline", "topPerformer", "floorNote", "recommendation"],
  },
};

function buildPrompt(
  recommendations: BudgetRecommendation[],
  byPlatform: PlatformSummary[],
): string {
  const platforms = byPlatform
    .map(
      (p) =>
        `${p.platform}: spend ${money(p.totalSpend)}, ROAS ${ratio(
          p.blendedRoas,
        )}, current budget ${money(p.totalCurrentBudget)} → recommended ${money(
          p.totalRecommendedBudget,
        )}, prospecting split ${p.prospectingSplitPct.toFixed(0)}%${
          p.floorTriggered ? " (floor active)" : ""
        }${p.usingSampleData ? " [sample data]" : ""}`,
    )
    .join("\n");

  const rows = [...recommendations]
    .sort((a, b) => Math.abs(b.budgetDelta) - Math.abs(a.budgetDelta))
    .slice(0, 30)
    .map(
      (r) =>
        `${r.platform} | ${r.region} ${r.funnelStage} | ROAS ${ratio(
          r.roas,
        )} | budget ${money(r.currentBudget)} → ${money(r.recommendedBudget)} (${
          r.budgetDelta >= 0 ? "+" : ""
        }${money(r.budgetDelta)})${r.z1Boosted ? " Z1" : ""}`,
    )
    .join("\n");

  return `PLATFORM SUMMARIES:\n${platforms}\n\nTOP BUDGET CHANGES:\n${rows}\n\nSummarise the day's recommendations via the tool.`;
}

export async function generateSummary(
  recommendations: BudgetRecommendation[],
  byPlatform: PlatformSummary[],
  env: Record<string, string | undefined> = process.env,
): Promise<BudgetSummary> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey || !recommendations.length) {
    return heuristicSummary(recommendations, byPlatform);
  }

  const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "budget_summary" },
      messages: [{ role: "user", content: buildPrompt(recommendations, byPlatform) }],
    });

    const block = resp.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return heuristicSummary(recommendations, byPlatform);
    }
    const input = block.input as SummaryShape;
    return {
      headline: input.headline,
      topPerformer: input.topPerformer,
      floorNote: input.floorNote ?? "",
      recommendation: input.recommendation,
      generatedBy: "claude",
      model,
    };
  } catch {
    return heuristicSummary(recommendations, byPlatform);
  }
}
