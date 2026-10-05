import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { IMPERSONATE_COOKIE, isOwnerDiscordId } from "@/lib/currentUser";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isOwnerDiscordId(session.user.id)) return null;
  return session.user.id;
}

/** Starts impersonating a user - owner only. Logged for accountability. */
export async function POST(request: Request) {
  const adminDiscordId = await requireOwner();
  if (!adminDiscordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.impersonationLog.create({ data: { adminDiscordId, targetUserId: userId } });

  cookies().set(IMPERSONATE_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 hours - impersonation shouldn't silently linger
  });

  return NextResponse.json({ ok: true });
}

/** Ends impersonation and closes the audit log entry. */
export async function DELETE() {
  const adminDiscordId = await requireOwner();
  if (!adminDiscordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const impersonatingId = cookies().get(IMPERSONATE_COOKIE)?.value;
  if (impersonatingId) {
    await prisma.impersonationLog.updateMany({
      where: { adminDiscordId, targetUserId: impersonatingId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  cookies().delete(IMPERSONATE_COOKIE);
  return NextResponse.json({ ok: true });
}
