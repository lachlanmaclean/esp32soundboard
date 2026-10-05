import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const res = await fetch(`${SERVER_URL}/api/presets?userId=${user.id}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { name } = (await request.json().catch(() => ({}))) as { name?: string };
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const res = await fetch(`${SERVER_URL}/api/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, name }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
