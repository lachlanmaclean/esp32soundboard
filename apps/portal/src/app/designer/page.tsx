import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { shouldShowChangelog } from "@/lib/changelog";
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

  const { user, isImpersonating } = await resolveEffectiveUser(session.user.id);

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

  const isPro = user.tier === "PRO";

  return (
    <Shell
      userName={user.discordUsername}
      userImage={user.discordAvatar}
      title="Designer"
      titleIcon="🧩"
      tier={user.tier}
      isImpersonating={isImpersonating}
      isOwner={!isImpersonating && isOwnerDiscordId(session.user.id)}
      showChangelog={shouldShowChangelog(user)}
    >
      <section className="card">
        <div className="card-header">
          <h2>🧩 Soundboard Designer</h2>
        </div>
        <p className="card-subtext">
          {isPro
            ? "Click a slot to put a sound there. The active preset is what shows up on your paired Gooseboard."
            : "Click a slot to put a sound on your board."}
        </p>
        <DesignerBoard librarySounds={sounds} tier={user.tier} />
      </section>
    </Shell>
  );
}
