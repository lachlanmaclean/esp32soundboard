import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SERVER_URL } from "@/lib/serverApi";

/** Backs the meme library's trending suggestions, shown before the user searches for anything. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const res = await fetch(`${SERVER_URL}/api/library/trending`);
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
