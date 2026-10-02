import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVER_URL } from "@/lib/serverApi";

/** Tap-to-play for a meme-library search result. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const { mp3Url } = (await request.json().catch(() => ({}))) as { mp3Url?: string };
  if (!mp3Url) {
    return NextResponse.json({ error: "mp3Url is required" }, { status: 400 });
  }

  const res = await fetch(`${SERVER_URL}/api/library/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id, mp3Url }),
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
