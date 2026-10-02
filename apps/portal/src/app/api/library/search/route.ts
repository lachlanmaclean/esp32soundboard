import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SERVER_URL } from "@/lib/serverApi";

/** Proxies the meme-library search box so the browser never talks to myinstants.com directly. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";

  try {
    // 15s: a little above the server's own ~12s curl ceiling, so a real
    // scrape timeout there surfaces as its JSON error instead of this
    // request aborting first with a generic one.
    const res = await fetch(`${SERVER_URL}/api/library/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch (error) {
    console.error("[api/library/search] request to server failed", error);
    return NextResponse.json({ error: "Search timed out" }, { status: 504 });
  }
}
