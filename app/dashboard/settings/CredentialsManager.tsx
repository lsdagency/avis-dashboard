"use client";

import { useState } from "react";
import type { CredGroup, CredStatus } from "@/lib/credentials";
import Toast, { type ToastMessage } from "@/components/ui/Toast";

export default function CredentialsManager({
  groups,
  initialStatus,
}: {
  groups: CredGroup[];
  initialStatus: CredStatus[];
}) {
  const [status, setStatus] = useState<Record<string, CredStatus>>(
    Object.fromEntries(initialStatus.map((s) => [s.key, s])),
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  async function refreshStatus() {
    const res = await fetch("/api/settings/credentials");
    if (res.ok) {
      const d = (await res.json()) as { status: CredStatus[] };
      setStatus(Object.fromEntries(d.status.map((s) => [s.key, s])));
    }
  }

  async function save(key: string) {
    const value = values[key];
    if (!value) return;
    setBusy(key);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setToast({ kind: "error", text: d.error || "Save failed" });
        return;
      }
      setValues((v) => ({ ...v, [key]: "" }));
      await refreshStatus();
      setToast({ kind: "success", text: `${key} saved.` });
    } finally {
      setBusy(null);
    }
  }

  async function clear(key: string) {
    setBusy(key);
    try {
      await fetch("/api/settings/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      await refreshStatus();
      setToast({ kind: "info", text: `${key} cleared.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.provider} className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display font-bold">{g.title}</h3>
            <a
              href={g.docUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-avis-red hover:underline"
            >
              {g.docLabel} ↗
            </a>
          </div>
          <p className="mt-1 text-xs text-black/50">{g.hint}</p>

          <div className="mt-4 space-y-3">
            {g.fields.map((f) => {
              const st = status[f.key];
              return (
                <div key={f.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{f.label}</label>
                    {st && (
                      <span
                        className={`text-xs ${
                          st.configured ? "text-positive" : "text-black/40"
                        }`}
                      >
                        {st.configured
                          ? `${st.source === "saved" ? "Saved" : "From env"} · ${st.preview}`
                          : "Not set"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {f.multiline ? (
                      <textarea
                        rows={3}
                        placeholder={f.placeholder || (f.secret ? "••••••" : "")}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
                      />
                    ) : (
                      <input
                        type={f.secret ? "password" : "text"}
                        placeholder={f.placeholder || (f.secret ? "••••••" : "")}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
                      />
                    )}
                    <button
                      onClick={() => save(f.key)}
                      disabled={busy === f.key || !values[f.key]}
                      className="rounded-lg bg-avis-red px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      Save
                    </button>
                    {st?.source === "saved" && (
                      <button
                        onClick={() => clear(f.key)}
                        disabled={busy === f.key}
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm transition hover:bg-avis-grey disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
