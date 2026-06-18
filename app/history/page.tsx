import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { getDashboardData, parseDate } from "@/lib/integrations";
import DashboardClient from "../dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date: dateParam } = await searchParams;
  const date = parseDate(dateParam);
  const initialData = await getDashboardData(date);

  return (
    <div className="min-h-screen bg-avis-grey">
      <AppHeader session={session} title="Historical Report" />
      <DashboardClient
        initialData={initialData}
        role={session.role}
        date={date}
        historical
      />
    </div>
  );
}
