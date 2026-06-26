import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { CREDENTIAL_GROUPS, credentialStatus } from "@/lib/credentials";
import { listUsers } from "@/lib/repo";
import {
  getProspectingFloor,
  getZ1Multiplier,
  getMonthlyBudget,
  getPacingStance,
  getMtdOverride,
} from "@/lib/settings";
import { monthToDateSpend, todayInTz } from "@/lib/integrations";
import CredentialsManager from "./CredentialsManager";
import UserManager from "./UserManager";
import BudgetSettings from "./BudgetSettings";
import MonthlyPacingSettings from "./MonthlyPacingSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const today = todayInTz();
  const month = today.slice(0, 7);
  const [status, users, floor, z1, monthlyBudget, stance, override, mtdAuto] =
    await Promise.all([
      credentialStatus(),
      listUsers(),
      getProspectingFloor(),
      getZ1Multiplier(),
      getMonthlyBudget(),
      getPacingStance(),
      getMtdOverride(month),
      monthToDateSpend(today),
    ]);

  return (
    <div className="min-h-screen bg-avis-grey">
      <AppHeader session={session} title="Settings" />
      <main className="mx-auto max-w-4xl space-y-8 px-6 py-6">
        <section>
          <h2 className="font-display text-xl font-bold">Integrations & API keys</h2>
          <p className="mt-1 text-sm text-black/60">
            Keys saved here are encrypted (AES-256-GCM) and override the matching
            environment variable. Platforms without keys fall back to sample data.
          </p>
          <div className="mt-4">
            <CredentialsManager groups={CREDENTIAL_GROUPS} initialStatus={status} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold">Budget engine</h2>
          <p className="mt-1 text-sm text-black/60">
            Controls how recommended budgets are reweighted toward the
            best-performing regions within each platform.
          </p>
          <div className="mt-4">
            <BudgetSettings
              initialFloorPct={Math.round(floor * 100)}
              initialZ1={z1}
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold">Monthly budget &amp; pacing</h2>
          <p className="mt-1 text-sm text-black/60">
            Set the total monthly budget and how to pace it. Recommended daily
            budgets are capped so the month never overspends.
          </p>
          <div className="mt-4">
            <MonthlyPacingSettings
              initialMonthlyBudget={monthlyBudget}
              initialStance={stance}
              initialOverride={override}
              mtdAuto={mtdAuto}
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold">Dashboard users</h2>
          <p className="mt-1 text-sm text-black/60">
            Admins can push budgets and refresh. Clients (Avis team) are
            view-only.
          </p>
          <div className="mt-4">
            <UserManager initialUsers={users} currentEmail={session.email} />
          </div>
        </section>
      </main>
    </div>
  );
}
