import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

export async function PUT(request: Request, { params }: { params: { id: string; position: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { soundId, color } = (await request.json().catch(() => ({}))) as {
    soundId?: string;
    color?: string | null;
  };
  if (!soundId) return NextResponse.json({ error: "soundId is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}/slots/${params.position}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soundId, color }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}

/** Changes just the color override at an already-filled position. */
export async function PATCH(request: Request, { params }: { params: { id: string; position: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { color } = (await request.json().catch(() => ({}))) as { color?: string | null };
  if (color === undefined) return NextResponse.json({ error: "color is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}/slots/${params.position}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}

export async function DELETE(_request: Request, { params }: { params: { id: string; position: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}/slots/${params.position}`, { method: "DELETE" });
  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
