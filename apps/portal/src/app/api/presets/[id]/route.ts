import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { SERVER_URL } from "@/lib/serverApi";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  return NextResponse.json(resBody, { status: res.status });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const res = await fetch(`${SERVER_URL}/api/presets/${params.id}`, { method: "DELETE" });
  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
