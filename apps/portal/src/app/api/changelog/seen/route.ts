import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { LATEST_CHANGELOG_VERSION } from "@/lib/changelog";

/** Marks the current changelog entry as seen by the signed-in user - the admin page reads this back. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeenChangelogVersion: LATEST_CHANGELOG_VERSION },
  });

  return NextResponse.json({ ok: true });
}
