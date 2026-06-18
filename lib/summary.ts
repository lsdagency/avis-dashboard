import type {
  BudgetRecommendation,
  BudgetSummary,
  PlatformSummary,
} from "./types";
import { money, ratio } from "./format";

/**
 * Deterministic plain-English daily summary shown at the top of the dashboard.
 * Computed locally from the recommendations — no external API or key required.
 */
export function buildSummary(
  recommendations: BudgetRecommendation[],
  byPlatform: PlatformSummary[],
): BudgetSummary {
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
