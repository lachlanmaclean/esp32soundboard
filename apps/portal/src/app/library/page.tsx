import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { SERVER_URL, PUBLIC_API_URL } from "@/lib/serverApi";
import { LIBRARY_SOUND_LIMIT, PRO_LIBRARY_SOUND_LIMIT } from "@gooseboard/shared";
import { Shell } from "@/components/Shell";
import { SoundPreviewButton } from "@/components/SoundPreviewButton";
import { UploadForm } from "@/components/UploadForm";

export const metadata = {
  title: "Gooseboard — Sound library",
};

export default async function LibraryPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">🔊</div>
          <h1>Gooseboard</h1>
          <p>Sign in with Discord to manage your sound library.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord?callbackUrl=/library">
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
          <div className="auth-logo">🔊</div>
          <h1>Gooseboard</h1>
          <p>Could not find your account. Try signing in again.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signout">
            Sign out
          </a>
        </div>
      </main>
    );
  }

  const sounds = await prisma.sound.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const libraryLimit = user.tier === "PRO" ? PRO_LIBRARY_SOUND_LIMIT : LIBRARY_SOUND_LIMIT;

  async function uploadSoundAction(formData: FormData) {
    "use server";
    const upstream = new FormData();
    upstream.append("userId", user!.id);
    upstream.append("displayName", formData.get("displayName") as string);
    upstream.append("color", formData.get("color") as string);
    const icon = formData.get("icon") as string;
    if (icon) upstream.append("icon", icon);
    upstream.append("audio", formData.get("audio") as File);

    const res = await fetch(`${SERVER_URL}/api/sounds`, { method: "POST", body: upstream });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      redirect(`/library?error=${encodeURIComponent(body.error ?? "Upload failed")}`);
    }
    revalidatePath("/library");
  }

  async function deleteSoundAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await fetch(`${SERVER_URL}/api/sounds/${id}`, { method: "DELETE" });
    revalidatePath("/library");
  }

  return (
    <Shell
      userName={user.discordUsername}
      userImage={user.discordAvatar}
      title="Sound library"
      titleIcon="🔊"
      tier={user.tier}
      isImpersonating={isImpersonating}
      isOwner={!isImpersonating && isOwnerDiscordId(session.user.id)}
    >
      {searchParams.error && <p className="alert">{searchParams.error}</p>}

      <section className="card">
        <div className="card-header">
          <h2>🔊 Sound library</h2>
          <span className="count-badge">{sounds.length}/{libraryLimit}</span>
        </div>

        {sounds.length === 0 ? (
          <div className="empty-state">No sounds yet. Upload one below to get started.</div>
        ) : (
          <div className="sound-list">
            {sounds.map((sound) => (
              <div key={sound.id} className="sound-row" style={{ borderLeftColor: sound.color }}>
                <span className="sound-row-name" style={{ color: sound.color }}>
                  <span>{sound.icon ?? "🔊"}</span>
                  <span>{sound.displayName}</span>
                </span>

                <div className="sound-row-controls">
                  <SoundPreviewButton src={`${PUBLIC_API_URL}${sound.audioUrl}`} />

                  <div className="sound-row-actions">
                    <form action={deleteSoundAction} className="delete-form">
                      <input type="hidden" name="id" value={sound.id} />
                      <button className="icon-btn icon-btn-danger" type="submit" title="Delete" aria-label="Delete">
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sounds.length < libraryLimit && (
          <UploadForm action={uploadSoundAction} buttonLabel="Upload" />
        )}
      </section>
    </Shell>
  );
}
