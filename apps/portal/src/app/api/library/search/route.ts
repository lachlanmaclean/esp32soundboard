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
  const res = await fetch(`${SERVER_URL}/api/library/search?q=${encodeURIComponent(query)}`);

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
