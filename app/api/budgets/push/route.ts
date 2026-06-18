import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { pushBudgets, parseDate } from "@/lib/integrations";
import { resolveEnv } from "@/lib/credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Push today's recommended budgets to each platform's API, mark applied. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { searchParams } = new URL(req.url);
  const date = parseDate(searchParams.get("date"));

  const outcome = await pushBudgets(date, await resolveEnv());
  return NextResponse.json(outcome);
}
