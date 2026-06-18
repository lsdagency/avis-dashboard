/** Plain-English explanation of the four budget-engine rules. Always visible. */
export default function RecommendationLegend() {
  const rules: { title: string; detail: string }[] = [
    {
      title: "Flexible Prospecting/Retargeting split (60% floor)",
      detail:
        "ROAS performance sets the split freely. The 60% Prospecting floor only kicks in if performance would otherwise push Prospecting below it.",
    },
    {
      title: "Cross-funnel ROAS normalisation",
      detail:
        "Each campaign's ROAS is divided by its funnel-stage average before weighting, so Retargeting's structurally higher ROAS doesn't drain Prospecting.",
    },
    {
      title: "Z1 region priority (1.25×)",
      detail:
        "GB, FR, ES, DE and IT receive a 1.25× multiplier on their ROAS score before normalisation. All other European regions compete equally.",
    },
    {
      title: "Guard rails (+100% / −50% per day)",
      detail:
        "No campaign's budget can more than double or fall by more than half in a single day, then budgets are renormalised to the same total pool.",
    },
  ];

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <h3 className="font-display text-base font-bold">How recommendations are calculated</h3>
      <p className="mt-1 text-xs text-black/50">
        Budgets are reweighted within each platform's own pool — never mixed
        between Meta, Reddit and TikTok.
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {rules.map((r) => (
          <div key={r.title}>
            <dt className="text-sm font-bold text-avis-red">{r.title}</dt>
            <dd className="mt-0.5 text-sm text-black/70">{r.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
