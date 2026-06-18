import type { PlatformSummary } from "@/lib/types";
import { percent } from "@/lib/format";

/** The weighted Prospecting split, with a per-platform breakdown on hover. */
export default function ProspectingSplitBadge({
  value,
  byPlatform,
}: {
  value: number;
  byPlatform: PlatformSummary[];
}) {
  const tooltip = byPlatform
    .map((p) => `${p.platform}: ${p.prospectingSplitPct.toFixed(0)}% prospecting`)
    .join(" · ");

  return (
    <div className="group relative inline-block">
      <span className="cursor-default">{percent(value)}</span>
      <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden whitespace-nowrap rounded-lg bg-black px-3 py-2 text-xs font-normal text-white group-hover:block">
        {tooltip}
      </div>
    </div>
  );
}
