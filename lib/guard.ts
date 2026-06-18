import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";

/**
 * For API routes that only the LSD Agency admin may call (push budgets, refresh).
 * Returns the session, or a 401/403 response to return early.
 */
export async function requireAdmin(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

/** For routes any signed-in user may call. */
export async function requireSession(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}
