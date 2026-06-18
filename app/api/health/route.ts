import { NextResponse } from "next/server";

/** Public health check for Netlify. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
