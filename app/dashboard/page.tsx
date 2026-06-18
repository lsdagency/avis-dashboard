import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { getDashboardData, todayInTz } from "@/lib/integrations";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const date = todayInTz();
  const initialData = await getDashboardData(date);

  return (
    <div className="min-h-screen bg-avis-grey">
      <AppHeader session={session} title="Live Reporting" />
      <DashboardClient
        initialData={initialData}
        role={session.role}
        date={date}
        historical={false}
      />
    </div>
  );
}
