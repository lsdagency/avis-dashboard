import type { PlatformSummary } from "@/lib/types";

/** Always-visible per-platform live/sample status badges. */
export default function PlatformStatusBadges({
  byPlatform,
}: {
  byPlatform: PlatformSummary[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {byPlatform.map((p) => (
        <div
          key={p.platform}
          className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm"
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              p.usingSampleData ? "bg-amber-500" : "bg-positive"
            }`}
            aria-hidden
          />
          <span className="font-display font-bold">{p.platform}</span>
          <span className="text-black/50">
            {p.usingSampleData ? "Sample data" : "Live"}
          </span>
          {p.usingSampleData && p.error && (
            <span className="text-xs text-black/40" title={p.error}>
              — {p.error.length > 40 ? `${p.error.slice(0, 39)}…` : p.error}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
