import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

/** Looks up a YouTube video and downloads its audio for local preview (Pro only, never saved to the library). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  // yt-dlp can take a while on a cold lookup+download - give it real room
  // rather than the 15s ceiling used for the fast myinstants scrape calls.
  const res = await fetch(`${SERVER_URL}/api/youtube/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, url }),
    signal: AbortSignal.timeout(90_000),
  }).catch((error) => {
    console.error("[api/youtube/resolve] request to server failed", error);
    return null;
  });

  if (!res) return NextResponse.json({ error: "Video lookup timed out" }, { status: 504 });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
