import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDashboardData, parseDate } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/** Normalised dashboard data for a date. Any signed-in user (admin or client). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = parseDate(searchParams.get("date"));
  const refresh = searchParams.get("refresh") === "1";

  const data = await getDashboardData(date, { refresh });
  return NextResponse.json(data);
}
