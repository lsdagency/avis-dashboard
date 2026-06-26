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
  getMonthlyBudget,
  setMonthlyBudget,
  getPacingStance,
  setPacingStance,
  getMtdOverride,
  setMtdOverride,
  MAX_PACING_STANCE,
} from "@/lib/settings";
import { monthToDateSpend, todayInTz } from "@/lib/integrations";

export const dynamic = "force-dynamic";

async function currentConfig() {
  const today = todayInTz();
  const month = today.slice(0, 7);
  const [prospectingFloor, z1Multiplier, monthlyBudget, pacingStance, mtdOverride, mtdAuto] =
    await Promise.all([
      getProspectingFloor(),
      getZ1Multiplier(),
      getMonthlyBudget(),
      getPacingStance(),
      getMtdOverride(month),
      monthToDateSpend(today),
    ]);
  return {
    prospectingFloor,
    z1Multiplier,
    monthlyBudget,
    pacingStance,
    mtdOverride, // number | null
    mtdAuto, // tracked spend so far this month (placeholder for the override)
    month,
  };
}

/** Budget-engine + pacing config for the Settings UI. Admin only. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json(await currentConfig());
}

const Body = z
  .object({
    prospectingFloor: z.number().min(0).max(0.9).optional(),
    z1Multiplier: z.number().min(MIN_Z1_MULTIPLIER).max(MAX_Z1_MULTIPLIER).optional(),
    monthlyBudget: z.number().min(0).max(100_000_000).optional(),
    pacingStance: z.number().min(-MAX_PACING_STANCE).max(MAX_PACING_STANCE).optional(),
    // null clears the override (falls back to tracked spend).
    mtdOverride: z.number().min(0).nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Nothing to update",
  });

export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const b = parsed.data;
  if (b.prospectingFloor !== undefined) await setProspectingFloor(b.prospectingFloor);
  if (b.z1Multiplier !== undefined) await setZ1Multiplier(b.z1Multiplier);
  if (b.monthlyBudget !== undefined) await setMonthlyBudget(b.monthlyBudget);
  if (b.pacingStance !== undefined) await setPacingStance(b.pacingStance);
  if (b.mtdOverride !== undefined) {
    await setMtdOverride(todayInTz().slice(0, 7), b.mtdOverride);
  }
  return NextResponse.json({ ok: true, ...(await currentConfig()) });
}
