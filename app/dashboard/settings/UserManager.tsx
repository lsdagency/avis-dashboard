"use client";

import { useState } from "react";
import type { UserRecord } from "@/lib/repo";
import Toast, { type ToastMessage } from "@/components/ui/Toast";

export default function UserManager({
  initialUsers,
  currentEmail,
}: {
  initialUsers: UserRecord[];
  currentEmail: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "client" as "admin" | "client",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  async function reload() {
    const res = await fetch("/api/settings/users");
    if (res.ok) {
      const d = (await res.json()) as { users: UserRecord[] };
      setUsers(d.users);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setToast({ kind: "error", text: d.error || "Create failed" });
        return;
      }
      setForm({ email: "", name: "", role: "client", password: "" });
      await reload();
      setToast({ kind: "success", text: "User added." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/settings/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setToast({ kind: "error", text: d.error || "Delete failed" });
      return;
    }
    await reload();
    setToast({ kind: "info", text: "User removed." });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-avis-grey text-left">
            <th className="px-3 py-2 font-bold">Name</th>
            <th className="px-3 py-2 font-bold">Email</th>
            <th className="px-3 py-2 font-bold">Role</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id} className={i % 2 ? "bg-gray-50" : "bg-white"}>
              <td className="px-3 py-2">{u.name}</td>
              <td className="px-3 py-2">{u.email}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    u.role === "admin" ? "bg-avis-red text-white" : "bg-avis-grey"
                  }`}
                >
                  {u.role === "admin" ? "Admin" : "Avis team"}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                {u.email !== currentEmail && (
                  <button
                    onClick={() => remove(u.id)}
                    className="text-xs text-avis-red hover:underline"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={add} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
        />
        <select
          value={form.role}
          onChange={(e) =>
            setForm((f) => ({ ...f, role: e.target.value as "admin" | "client" }))
          }
          className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
        >
          <option value="client">Avis team (client)</option>
          <option value="admin">Admin</option>
        </select>
        <input
          required
          type="password"
          placeholder="Password (min 6)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-avis-red"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-avis-red px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          Add user
        </button>
      </form>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
