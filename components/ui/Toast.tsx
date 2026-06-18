"use client";

import { useEffect } from "react";

export type ToastKind = "success" | "error" | "info";
export interface ToastMessage {
  kind: ToastKind;
  text: string;
}

const STYLES: Record<ToastKind, string> = {
  success: "bg-positive text-white",
  error: "bg-avis-red text-white",
  info: "bg-black text-white",
};

export default function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div
        className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${STYLES[message.kind]}`}
      >
        <span className="flex-1">{message.text}</span>
        <button
          onClick={onDismiss}
          className="text-white/80 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
