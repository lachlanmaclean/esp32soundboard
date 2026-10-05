import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { Shell } from "@/components/Shell";
import { MemeLibrary } from "@/components/MemeLibrary";

export const metadata = {
  title: "Gooseboard — Meme library",
};

export default async function MemeLibraryPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🤣</div>
          <h1>Gooseboard</h1>
          <p>Sign in with Discord to browse the meme library.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord?callbackUrl=/meme-library">
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
          <div className="auth-logo">🤣</div>
          <h1>Gooseboard</h1>
          <p>Could not find your account. Try signing in again.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signout">
            Sign out
          </a>
        </div>
      </main>
    );
  }

  return (
    <Shell
      userName={user.discordUsername}
      userImage={user.discordAvatar}
      title="Meme library"
      titleIcon="🤣"
      tier={user.tier}
      isImpersonating={isImpersonating}
      isOwner={!isImpersonating && isOwnerDiscordId(session.user.id)}
    >
      <section className="card">
        <div className="card-header">
          <h2>🤣 Meme library</h2>
        </div>
        <MemeLibrary />
      </section>
    </Shell>
  );
}
