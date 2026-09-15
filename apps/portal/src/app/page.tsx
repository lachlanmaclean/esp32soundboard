import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVER_URL, PUBLIC_API_URL } from "@/lib/serverApi";
import { MAX_SOUNDS_PER_USER } from "@gooseboard/shared";
import { Shell } from "@/components/Shell";

export default async function HomePage({ searchParams }: { searchParams: { error?: string } }) {
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

  const sounds = await prisma.sound.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const devices = await prisma.device.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });

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
      redirect(`/?error=${encodeURIComponent(body.error ?? "Upload failed")}`);
    }
    revalidatePath("/");
  }

  async function deleteSoundAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await fetch(`${SERVER_URL}/api/sounds/${id}`, { method: "DELETE" });
    revalidatePath("/");
  }

  async function playSoundAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const res = await fetch(`${SERVER_URL}/api/sounds/${id}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user!.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      redirect(`/?error=${encodeURIComponent(body.error ?? "Playback failed")}`);
    }
  }

  async function unpairDeviceAction(formData: FormData) {
    "use server";
    const cuid = formData.get("cuid") as string;
    await fetch(`${SERVER_URL}/api/devices/${cuid}/unpair`, { method: "POST" });
    revalidatePath("/");
  }


  return (
    <Shell userName={session.user.name ?? "Unknown"} userImage={session.user.image} title="Dashboard" titleIcon="🪿">
      {searchParams.error && <p className="alert">{searchParams.error}</p>}

      <section className="card" id="sounds">
        <div className="card-header">
          <h2>🔊 Sound library</h2>
          <span className="count-badge">
            <a href="/board">Open soundboard →</a> &nbsp; {sounds.length}/{MAX_SOUNDS_PER_USER}
          </span>
        </div>

        {sounds.length === 0 ? (
          <div className="empty-state">No sounds yet. Upload one below to get started.</div>
        ) : (
          <div className="sound-grid">
            {sounds.map((sound) => (
              <div key={sound.id} className="sound-tile" style={{ borderLeftColor: sound.color }}>
                <div className="sound-tile-head">
                  <span className="sound-tile-name" style={{ color: sound.color }}>
                    <span>{sound.icon ?? "🔊"}</span>
                    <span>{sound.displayName}</span>
                  </span>
                  <form action={deleteSoundAction} className="delete-form">
                    <input type="hidden" name="id" value={sound.id} />
                    <button className="btn-danger" type="submit" title="Delete">✕</button>
                  </form>
                </div>
                <audio controls src={`${PUBLIC_API_URL}${sound.audioUrl}`} />
                <form action={playSoundAction}>
                  <input type="hidden" name="id" value={sound.id} />
                  <button className="btn btn-success btn-block" type="submit">▶ Play in Discord</button>
                </form>
              </div>
            ))}
          </div>
        )}

        {sounds.length < MAX_SOUNDS_PER_USER && (
          <form action={uploadSoundAction} className="field-row">
            <input type="text" name="displayName" placeholder="Name" required />
            <input type="color" name="color" defaultValue="#5865F2" required />
            <input type="text" name="icon" placeholder="Icon (emoji)" maxLength={4} style={{ width: 110 }} />
            <input type="file" name="audio" accept="audio/mpeg,audio/wav,audio/ogg" required />
            <button className="btn btn-primary" type="submit">Upload</button>
          </form>
        )}
      </section>

      <section className="card" id="devices">
        <div className="card-header">
          <h2>📟 Devices</h2>
          <span className="count-badge">{devices.length}</span>
        </div>

        {devices.length === 0 ? (
          <div className="empty-state">No devices paired yet. Scan the QR code on your Gooseboard&apos;s screen to pair one.</div>
        ) : (
          <div className="device-list">
            {devices.map((device) => (
              <div key={device.cuid} className="device-row">
                <span className="status-dot" />
                <div className="device-info">
                  <span className="device-id">{device.cuid}</span>
                  <span className="device-seen">
                    Last seen {device.lastSeenAt?.toLocaleString() ?? "never"}
                  </span>
                </div>
                <form action={unpairDeviceAction}>
                  <input type="hidden" name="cuid" value={device.cuid} />
                  <button className="btn btn-danger" type="submit">Unpair</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

    </Shell>
  );
}
