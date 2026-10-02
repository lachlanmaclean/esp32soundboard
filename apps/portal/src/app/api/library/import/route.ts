import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVER_URL } from "@/lib/serverApi";

/** Downloads a meme-library search result into the signed-in user's own sound library. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const { mp3Url, displayName } = (await request.json().catch(() => ({}))) as {
    mp3Url?: string;
    displayName?: string;
  };
  if (!mp3Url || !displayName) {
    return NextResponse.json({ error: "mp3Url and displayName are required" }, { status: 400 });
  }

  const res = await fetch(`${SERVER_URL}/api/library/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, mp3Url, displayName }),
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
