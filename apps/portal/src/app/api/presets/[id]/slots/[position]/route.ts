import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

export async function PUT(request: Request, { params }: { params: { id: string; position: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { soundId } = (await request.json().catch(() => ({}))) as { soundId?: string };
  if (!soundId) return NextResponse.json({ error: "soundId is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}/slots/${params.position}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ soundId }),
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
