import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { DesignerBoard } from "@/components/DesignerBoard";

export const metadata = {
  title: "Gooseboard — Designer",
};

export default async function DesignerPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🪿</div>
          <h1>Gooseboard</h1>
          <p>Sign in to design your soundboard.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord?callbackUrl=/designer">
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
    select: { id: true, displayName: true, color: true, icon: true },
  });

  return (
    <Shell userName={session.user.name ?? "Unknown"} userImage={session.user.image} title="Designer" titleIcon="🧩">
      <section className="card">
        <div className="card-header">
          <h2>🧩 Soundboard Designer</h2>
        </div>
        <p className="card-subtext">
          Click a slot on the board below to put a sound there. The active preset is what shows up on your paired
          Gooseboard - if you leave gaps, the physical device packs your sounds together in order rather than
          leaving blank buttons, since it just draws however many buttons it's sent.
        </p>
        <DesignerBoard librarySounds={sounds} />
      </section>
    </Shell>
  );
}
