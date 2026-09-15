import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <main>
        <h1>Gooseboard</h1>
        <a href="/api/auth/signin/discord">Sign in with Discord</a>
      </main>
    );
  }

  return (
    <main>
      <h1>Gooseboard</h1>
      <p>Signed in as {session.user?.name}</p>
      {/* TODO: sound library management, device list */}
    </main>
  );
}
