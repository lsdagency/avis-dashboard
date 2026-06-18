"use client";

import { useState } from "react";
import ConfirmModal from "../ui/ConfirmModal";
import type { ToastMessage } from "../ui/Toast";

interface PushOutcome {
  applied: number;
  failed: number;
  errors: string[];
  byPlatform: { platform: string; applied: number; failed: number }[];
}

export default function PushBudgetsButton({
  date,
  campaignCount,
  appliedToday,
  onToast,
  onApplied,
}: {
  date: string;
  campaignCount: number;
  appliedToday: boolean;
  onToast: (t: ToastMessage) => void;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets/push?date=${date}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as PushOutcome & {
        error?: string;
      };
      if (!res.ok) {
        onToast({ kind: "error", text: data.error || "Push failed" });
        return;
      }
      if (data.failed > 0) {
        onToast({
          kind: "error",
          text: `${data.applied} budgets applied, ${data.failed} failed. Check logs for details.`,
        });
      } else {
        onToast({ kind: "success", text: `${data.applied} budgets applied across all platforms.` });
      }
      onApplied();
    } catch {
      onToast({ kind: "error", text: "Network error pushing budgets." });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={appliedToday}
        className="rounded-md bg-avis-red px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-black/50"
        title={appliedToday ? "Budgets already applied for this date" : undefined}
      >
        {appliedToday ? "Budgets applied ✓" : "Apply Recommended Budgets"}
      </button>

      <ConfirmModal
        open={open}
        title="Apply recommended budgets?"
        body={`This will update daily budgets for ${campaignCount} campaigns across Meta, Reddit and TikTok. Are you sure?`}
        confirmLabel="Apply budgets"
        loading={loading}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
