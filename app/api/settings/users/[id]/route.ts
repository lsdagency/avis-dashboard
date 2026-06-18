import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guard";
import { deleteUser, listUsers } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Delete a dashboard user. Admin only. Refuses to remove the last admin. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const users = await listUsers();
  const target = users.find((u) => u.id === numId);
  if (target?.role === "admin" && users.filter((u) => u.role === "admin").length <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last admin." },
      { status: 400 },
    );
  }

  await deleteUser(numId);
  return NextResponse.json({ ok: true });
}
