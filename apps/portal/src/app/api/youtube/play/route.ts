import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

/** Plays an already-resolved YouTube preview into the user's Discord voice channel. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { streamUrl } = (await request.json().catch(() => ({}))) as { streamUrl?: string };
  if (!streamUrl) return NextResponse.json({ error: "streamUrl is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/youtube/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, streamUrl }),
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
