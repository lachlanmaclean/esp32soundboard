import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { shouldShowChangelog } from "@/lib/changelog";
import { Shell } from "@/components/Shell";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="landing">
        <header className="landing-nav">
          <div className="landing-brand">
            <span className="landing-brand-mark">🪿</span>
            Gooseboard
          </div>
          <a className="btn btn-primary" href="/api/auth/signin/discord">
            Sign in with Discord
          </a>
        </header>

        <section className="landing-hero">
          <span className="landing-hero-icon">🪿</span>
          <h1>Build a soundboard for your Discord server.</h1>
          <p>
            Upload clips, arrange them into a board, and play them straight into any voice channel you&apos;re
            in - from your browser or a paired physical device.
          </p>
          <a className="btn btn-primary btn-lg" href="/api/auth/signin/discord">
            Sign in with Discord
          </a>
          <p className="landing-hero-note">Gooseboard is not affiliated with Discord Inc.</p>
        </section>

        <section className="landing-features">
          <div className="landing-feature">
            <span className="landing-feature-icon">🎛️</span>
            <h3>Soundboard</h3>
            <p>Tap a tile to play a clip straight into your voice channel.</p>
          </div>
          <div className="landing-feature">
            <span className="landing-feature-icon">🧩</span>
            <h3>Designer</h3>
            <p>Arrange sounds onto a board and save it as a preset.</p>
          </div>
          <div className="landing-feature">
            <span className="landing-feature-icon">🔊</span>
            <h3>Sound library</h3>
            <p>Upload, preview and manage every sound you own.</p>
          </div>
          <div className="landing-feature">
            <span className="landing-feature-icon">🤣</span>
            <h3>Meme library</h3>
            <p>Search myinstants.com and add clips straight to your library.</p>
          </div>
        </section>

        <footer className="landing-footer">Gooseboard</footer>
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
      showChangelog={shouldShowChangelog(user)}
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
          <a className="hub-card" href="/youtube">
            <span className="hub-card-icon">📺</span>
            <span className="hub-card-title">YouTube</span>
            <span className="hub-card-subtext">Play a video's audio, in the browser or straight to Discord.</span>
          </a>
        )}
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
