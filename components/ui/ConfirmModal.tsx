"use client";

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-black/70">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm transition hover:bg-avis-grey disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-avis-red px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
