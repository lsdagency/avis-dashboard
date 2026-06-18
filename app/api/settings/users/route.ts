import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/guard";
import { listUsers, createUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** List dashboard users. Admin only. */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  return NextResponse.json({ users: await listUsers() });
}

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "client"]),
  password: z.string().min(6),
});

/** Add a dashboard user. Admin only. */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const user = await createUser(parsed.data);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 },
    );
  }
}
