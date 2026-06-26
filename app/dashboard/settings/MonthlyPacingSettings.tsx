"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import Toast, { type ToastMessage } from "@/components/ui/Toast";

export default function MonthlyPacingSettings({
  initialMonthlyBudget,
  initialStance,
  initialOverride,
  mtdAuto,
}: {
  initialMonthlyBudget: number;
  initialStance: number;
  initialOverride: number | null;
  mtdAuto: number;
}) {
  const [budget, setBudget] = useState(String(initialMonthlyBudget || ""));
  const [stance, setStance] = useState(initialStance);
  const [override, setOverride] = useState(
    initialOverride != null ? String(initialOverride) : "",
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const stanceLabel =
    stance === 0
      ? "Even — spread the remaining budget evenly"
      : stance > 0
        ? `Push now — spend ${stance}% above even pace today`
        : `Hold back — spend ${Math.abs(stance)}% below even pace today`;

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, number | null> = {
        monthlyBudget: Number(budget) || 0,
        pacingStance: stance,
        // Empty box clears the override (falls back to tracked spend).
        mtdOverride: override.trim() === "" ? null : Math.max(0, Number(override)),
      };
      const res = await fetch("/api/settings/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setToast({ kind: "error", text: d.error || "Save failed" });
        return;
      }
      setToast({ kind: "success", text: "Monthly pacing saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      {/* Monthly budget */}
      <div>
        <label className="block text-sm font-bold">Monthly budget (all platforms)</label>
        <p className="mt-1 text-xs text-black/50">
          Total to spend this month across Meta, Reddit and TikTok. Leave at 0 to
          turn pacing off (budgets are then reallocated without a monthly cap).
        </p>
        <div className="mt-3 flex items-center gap-1">
          <span className="text-sm text-black/60">£</span>
          <input
            type="number"
            min={0}
            step={500}
            placeholder="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-40 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
          />
        </div>
      </div>

      {/* Pacing stance */}
      <div className="border-t border-black/5 pt-5">
        <label className="block text-sm font-bold">Pacing stance</label>
        <p className="mt-1 text-xs text-black/50">
          Lean the spend earlier or later in the month — e.g. push harder during a
          live promotion, or hold back to save for an end-of-month push. Today's
          budget can never exceed what's left for the month.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <span className="w-16 text-right text-xs text-black/40">Hold back</span>
          <input
            type="range"
            min={-50}
            max={50}
            step={5}
            value={stance}
            onChange={(e) => setStance(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-avis-red"
          />
          <span className="w-16 text-xs text-black/40">Push now</span>
          <span className="w-12 text-right text-sm font-medium tabular-nums">
            {stance > 0 ? "+" : ""}
            {stance}%
          </span>
        </div>
        <p className="mt-1 text-xs text-black/50">{stanceLabel}</p>
      </div>

      {/* MTD override */}
      <div className="border-t border-black/5 pt-5">
        <label className="block text-sm font-bold">
          Spent so far this month (override)
        </label>
        <p className="mt-1 text-xs text-black/50">
          Tracked spend so far this month: <strong>{money(mtdAuto)}</strong>. Leave
          blank to use it, or enter a figure to override (useful before the daily
          tracking has a full month of history).
        </p>
        <div className="mt-3 flex items-center gap-1">
          <span className="text-sm text-black/60">£</span>
          <input
            type="number"
            min={0}
            step={100}
            placeholder={mtdAuto.toFixed(2)}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            className="w-40 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
          />
          {override !== "" && (
            <button
              onClick={() => setOverride("")}
              className="ml-2 text-xs text-avis-red hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-black/5 pt-4">
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
