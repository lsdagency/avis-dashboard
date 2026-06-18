import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import { getProspectingFloor, setProspectingFloor } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Budget-engine config for the Settings UI. Admin only. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({ prospectingFloor: await getProspectingFloor() });
}

const Body = z.object({
  // 0–0.9 fraction (UI sends a fraction, e.g. 0.5 for 50%).
  prospectingFloor: z.number().min(0).max(0.9),
});

export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await setProspectingFloor(parsed.data.prospectingFloor);
  return NextResponse.json({ ok: true, prospectingFloor: await getProspectingFloor() });
}
