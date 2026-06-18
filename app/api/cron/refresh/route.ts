import { NextResponse } from "next/server";
import { runRefresh, todayInTz } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Internal cron endpoint hit by the Netlify Scheduled Function. Protected by the
 * shared CRON_SECRET header — not a session cookie (this is the public prefix).
 */
export async function POST(req: Request) {
  const provided = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = todayInTz();
  const data = await runRefresh(date);
  return NextResponse.json({
    ok: true,
    date,
    platforms: data.byPlatform.map((p) => ({
      platform: p.platform,
      usingSampleData: p.usingSampleData,
      error: p.error,
    })),
  });
}
