import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import {
  CREDENTIAL_GROUPS,
  credentialStatus,
  setCredential,
  deleteCredential,
} from "@/lib/credentials";

export const dynamic = "force-dynamic";

/** Masked credential status + group metadata for the Settings UI. Admin only. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({
    groups: CREDENTIAL_GROUPS,
    status: await credentialStatus(),
  });
}

const PutBody = z.object({ key: z.string(), value: z.string() });

/** Save (encrypt) a credential. Admin only. */
export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    await setCredential(parsed.data.key, parsed.data.value);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

const DeleteBody = z.object({ key: z.string() });

/** Clear a saved credential (falls back to env var). Admin only. */
export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await deleteCredential(parsed.data.key);
  return NextResponse.json({ ok: true });
}
