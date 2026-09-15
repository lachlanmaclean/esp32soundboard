import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchUserGuilds, buildBotInviteUrl } from "@/lib/discord";
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

  async function setGuildAction(formData: FormData) {
    "use server";
    const guildId = formData.get("guildId") as string;
    await prisma.user.update({ where: { id: user!.id }, data: { guildId } });
    revalidatePath("/");
  }

  if (!user.guildId) {
    let eligibleGuilds: { id: string; name: string }[] = [];
    let error: string | null = null;

    try {
      const [userGuilds, botGuildsRes] = await Promise.all([
        fetchUserGuilds(session.discordAccessToken!),
        fetch(`${SERVER_URL}/api/bot/guilds`).then((r) => r.json()) as Promise<{ guildIds: string[] }>,
      ]);

      eligibleGuilds = userGuilds
        .filter((g) => g.canManage && botGuildsRes.guildIds.includes(g.id))
        .map((g) => ({ id: g.id, name: g.name }));
    } catch {
      error = "Could not load your Discord servers. Try signing in again.";
    }

    return (
      <main className="auth-screen">
        <div className="auth-card" style={{ maxWidth: 480, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="auth-logo" style={{ fontSize: 24 }}>🪿</span>
              <h1 style={{ fontSize: 18 }}>Gooseboard</h1>
            </div>
            <a className="btn-link" href="/api/auth/signout">Sign out</a>
          </div>

          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Choose a server</h2>
            <p>Pick the Discord server this device should play sounds into. The bot must already be invited to it.</p>
          </div>

          <p className="card-subtext">
            Don&apos;t see your server below?{" "}
            <a href={buildBotInviteUrl()} target="_blank" rel="noopener noreferrer">
              Add Gooseboard to a server
            </a>{" "}
            you manage, then reload this page.
          </p>

          {error && <p className="alert">{error}</p>}

          {!error && eligibleGuilds.length === 0 && (
            <div className="empty-state">No eligible servers found yet.</div>
          )}

          {!error && eligibleGuilds.length > 0 && (
            <form action={setGuildAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="guild-list">
                {eligibleGuilds.map((guild) => (
                  <label key={guild.id} className="guild-option">
                    <input type="radio" name="guildId" value={guild.id} required />
                    <span className="guild-icon">{guild.name.slice(0, 2).toUpperCase()}</span>
                    <span className="guild-option-name">{guild.name}</span>
                  </label>
                ))}
              </div>
              <button className="btn btn-primary btn-block" type="submit">Confirm</button>
            </form>
          )}
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
