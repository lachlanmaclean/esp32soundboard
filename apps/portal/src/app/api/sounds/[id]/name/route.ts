import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVER_URL } from "@/lib/serverApi";

/** Lets the rename control persist without a full page action/reload. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Ownership check: the server's route trusts whatever id it's given, so
  // the portal is the one place that has to confirm this sound is actually
  // this user's before forwarding the request.
  const sound = await prisma.sound.findUnique({ where: { id: params.id } });
  if (!sound || sound.userId !== user.id) {
    return NextResponse.json({ error: "Sound not found" }, { status: 404 });
  }

  const { displayName } = (await request.json().catch(() => ({}))) as { displayName?: string };
  if (!displayName?.trim()) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const res = await fetch(`${SERVER_URL}/api/sounds/${params.id}/name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
