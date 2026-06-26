"use client";

import { useState } from "react";
import Toast, { type ToastMessage } from "@/components/ui/Toast";

export default function BudgetSettings({
  initialFloorPct,
  initialZ1,
}: {
  initialFloorPct: number;
  initialZ1: number;
}) {
  const [pct, setPct] = useState(initialFloorPct);
  const [z1, setZ1] = useState(initialZ1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectingFloor: pct / 100, z1Multiplier: z1 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setToast({ kind: "error", text: d.error || "Save failed" });
        return;
      }
      setToast({
        kind: "success",
        text: `Saved — Prospecting floor ${pct}%, Z1 multiplier ×${z1.toFixed(2)}.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      {/* Prospecting floor */}
      <div>
        <label className="block text-sm font-bold">Prospecting floor</label>
        <p className="mt-1 text-xs text-black/50">
          Minimum share of each platform's daily budget guaranteed to Prospecting
          campaigns. The split otherwise follows current spend; this only lifts
          Prospecting when it would fall below the floor. Set to 0% to let
          performance fully decide.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-avis-red"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={90}
              value={pct}
              onChange={(e) => setPct(Math.min(90, Math.max(0, Number(e.target.value))))}
              className="w-16 rounded-lg border border-black/15 px-2 py-1.5 text-right text-sm outline-none focus:border-avis-red"
            />
            <span className="text-sm text-black/60">%</span>
          </div>
        </div>
      </div>

      {/* Z1 multiplier */}
      <div className="border-t border-black/5 pt-5">
        <label className="block text-sm font-bold">Z1 region multiplier</label>
        <p className="mt-1 text-xs text-black/50">
          ROAS boost applied to the five Z1 priority regions (GB, FR, ES, DE, IT)
          before budgets are weighted, so they win more budget at equal performance.
          Set to ×1.00 to treat all regions equally.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={z1}
            onChange={(e) => setZ1(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-avis-red"
          />
          <div className="flex items-center gap-1">
            <span className="text-sm text-black/60">×</span>
            <input
              type="number"
              min={1}
              max={2}
              step={0.05}
              value={z1}
              onChange={(e) =>
                setZ1(Math.min(2, Math.max(1, Number(e.target.value))))
              }
              className="w-20 rounded-lg border border-black/15 px-2 py-1.5 text-right text-sm outline-none focus:border-avis-red"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-black/5 pt-4">
        <p className="text-xs text-black/40">
          Budgets are reweighted toward the best-performing regions within each
          funnel (balanced tilt), capped at +100% / −50% per campaign per day.
        </p>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-avis-red px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
