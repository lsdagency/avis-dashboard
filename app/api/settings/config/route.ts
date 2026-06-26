import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import {
  getProspectingFloor,
  setProspectingFloor,
  getZ1Multiplier,
  setZ1Multiplier,
  MIN_Z1_MULTIPLIER,
  MAX_Z1_MULTIPLIER,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

async function currentConfig() {
  const [prospectingFloor, z1Multiplier] = await Promise.all([
    getProspectingFloor(),
    getZ1Multiplier(),
  ]);
  return { prospectingFloor, z1Multiplier };
}

/** Budget-engine config for the Settings UI. Admin only. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json(await currentConfig());
}

const Body = z
  .object({
    // 0–0.9 fraction (UI sends a fraction, e.g. 0.5 for 50%).
    prospectingFloor: z.number().min(0).max(0.9).optional(),
    z1Multiplier: z.number().min(MIN_Z1_MULTIPLIER).max(MAX_Z1_MULTIPLIER).optional(),
  })
  .refine((b) => b.prospectingFloor !== undefined || b.z1Multiplier !== undefined, {
    message: "Nothing to update",
  });

export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (parsed.data.prospectingFloor !== undefined) {
    await setProspectingFloor(parsed.data.prospectingFloor);
  }
  if (parsed.data.z1Multiplier !== undefined) {
    await setZ1Multiplier(parsed.data.z1Multiplier);
  }
  return NextResponse.json({ ok: true, ...(await currentConfig()) });
}
