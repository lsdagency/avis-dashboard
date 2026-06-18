"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm({
  demo,
}: {
  demo: { email: string; password: string } | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(demo?.email ?? "");
  const [password, setPassword] = useState(demo?.password ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
        return;
      }
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-black/70">Email</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 bg-white px-4 py-2.5 outline-none focus:border-avis-red focus:ring-2 focus:ring-avis-red/30"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-black/70">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 bg-white px-4 py-2.5 outline-none focus:border-avis-red focus:ring-2 focus:ring-avis-red/30"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-avis-red-soft px-4 py-2.5 text-sm text-avis-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-avis-red px-4 py-3 font-display font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {demo && (
        <p className="rounded-lg bg-avis-grey px-4 py-2.5 text-center text-xs text-black/60">
          Demo mode — prefilled credentials. Set <code>ADMIN_PASSWORD</code> /{" "}
          <code>CLIENT_PASSWORD</code> to lock it down.
        </p>
      )}
    </form>
  );
}
