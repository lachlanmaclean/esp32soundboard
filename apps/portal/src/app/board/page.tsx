import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SoundBoard } from "@/components/SoundBoard";

export const metadata = {
  title: "Gooseboard — Soundboard",
};

export default async function BoardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🪿</div>
          <h1>Gooseboard</h1>
          <p>Sign in to use your soundboard.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord?callbackUrl=/board">
            Sign in with Discord
          </a>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });

  if (!user) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🪿</div>
          <h1>Gooseboard</h1>
          <p>Could not find your account. Try signing in again.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signout">
            Sign out
          </a>
        </div>
      </main>
    );
  }

  const sounds = await prisma.sound.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="board-screen">
      <header className="board-header">
        <span className="board-brand">🪿 Gooseboard</span>
        <a className="btn-link" href="/">
          Manage
        </a>
      </header>

      <SoundBoard
        sounds={sounds.map((sound) => ({
          id: sound.id,
          displayName: sound.displayName,
          color: sound.color,
          icon: sound.icon,
        }))}
      />

      <p className="board-hint">Join a voice channel in Discord, then tap a sound.</p>
    </main>
  );
}
