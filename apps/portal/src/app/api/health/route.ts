import { NextResponse } from "next/server";

/** Container healthcheck target - deliberately does no auth/DB work, just confirms the Next.js server itself is up. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
