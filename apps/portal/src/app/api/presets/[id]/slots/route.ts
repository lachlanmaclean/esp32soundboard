import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

/** Appends a sound to the next open slot in a preset - always compacted, never a specific position. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { soundId } = (await request.json().catch(() => ({}))) as { soundId?: string };
  if (!soundId) return NextResponse.json({ error: "soundId is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}/slots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soundId }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
