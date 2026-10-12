import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

/** Changes the Discord volume of the web player's current track, live. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { volume } = (await request.json().catch(() => ({}))) as { volume?: number };
  if (typeof volume !== "number") return NextResponse.json({ error: "volume is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/youtube/volume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, volume }),
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
