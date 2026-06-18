import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { runRefresh, parseDate } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // platform pulls + Claude can take a few seconds

/** Pull all three platforms, recalc per-platform recommendations, upsert. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(req.url);
  const date = parseDate(searchParams.get("date"));

  const data = await runRefresh(date);
  return NextResponse.json(data);
}
