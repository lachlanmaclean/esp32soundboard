import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SERVER_URL } from "@/lib/serverApi";

/** Backs the meme library's trending suggestions, shown before the user searches for anything. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/library/trending`, { signal: AbortSignal.timeout(15_000) });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (error) {
    console.error("[api/library/trending] request to server failed", error);
    return NextResponse.json({ error: "Trending timed out" }, { status: 504 });
  }
}
