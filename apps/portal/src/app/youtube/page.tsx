import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { shouldShowChangelog } from "@/lib/changelog";
import { Shell } from "@/components/Shell";
import { YoutubePlayer } from "@/components/YoutubePlayer";

export const metadata = {
  title: "Gooseboard — YouTube",
};

export default async function YoutubePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">📺</div>
          <h1>Gooseboard</h1>
          <p>Sign in with Discord to play YouTube audio.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord?callbackUrl=/youtube">
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
          <div className="auth-logo">📺</div>
          <h1>Gooseboard</h1>
          <p>Could not find your account. Try signing in again.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signout">
            Sign out
          </a>
        </div>
      </main>
    );
  }

  if (user.tier !== "PRO") {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">📺</div>
          <h1>Pro feature</h1>
          <p>Playing YouTube audio is a Pro feature.</p>
        </div>
      </main>
    );
  }

  return (
    <Shell
      userName={user.discordUsername}
      userImage={user.discordAvatar}
      title="YouTube"
      titleIcon="📺"
      tier={user.tier}
      isImpersonating={isImpersonating}
      isOwner={!isImpersonating && isOwnerDiscordId(session.user.id)}
      showChangelog={shouldShowChangelog(user)}
    >
      <section className="card">
        <div className="card-header">
          <h2>📺 Play from YouTube</h2>
        </div>
        <p className="card-subtext">
          Paste a video URL and it plays straight away - add more while one's playing and they queue up, playing
          back to back automatically. Controls are in the player bar at the bottom of the screen. Nothing is saved
          to your library - videos over 15 minutes aren&apos;t supported.
        </p>
        <YoutubePlayer />
      </section>
    </Shell>
  );
}
