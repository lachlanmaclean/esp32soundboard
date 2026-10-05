import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { Shell } from "@/components/Shell";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🪿</div>
          <h1>Gooseboard</h1>
          <p>Sign in with Discord to manage your sound library and devices.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord">
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

  const isPro = user.tier === "PRO";

  return (
    <Shell
      userName={user.discordUsername}
      userImage={user.discordAvatar}
      title="Dashboard"
      titleIcon="🪿"
      tier={user.tier}
      isImpersonating={isImpersonating}
      isOwner={!isImpersonating && isOwnerDiscordId(session.user.id)}
    >
      <div className="hub-grid">
        <a className="hub-card" href="/board">
          <span className="hub-card-icon">🎛️</span>
          <span className="hub-card-title">Soundboard</span>
          <span className="hub-card-subtext">Tap a sound to play it in Discord.</span>
        </a>
        <a className="hub-card" href="/designer">
          <span className="hub-card-icon">🧩</span>
          <span className="hub-card-title">Designer</span>
          <span className="hub-card-subtext">Arrange sounds onto a board and save it as a preset.</span>
        </a>
        <a className="hub-card" href="/library">
          <span className="hub-card-icon">🔊</span>
          <span className="hub-card-title">Sound library</span>
          <span className="hub-card-subtext">Upload, preview and manage your sounds.</span>
        </a>
        <a className="hub-card" href="/meme-library">
          <span className="hub-card-icon">🤣</span>
          <span className="hub-card-title">Meme library</span>
          <span className="hub-card-subtext">Search myinstants.com and add clips to your library.</span>
        </a>
        {isPro && (
          <a className="hub-card" href="/devices">
            <span className="hub-card-icon">📟</span>
            <span className="hub-card-title">Devices</span>
            <span className="hub-card-subtext">Manage your paired Gooseboard devices.</span>
          </a>
        )}
      </div>
    </Shell>
  );
}
