import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchUserGuilds, buildBotInviteUrl } from "@/lib/discord";
import { SERVER_URL, PUBLIC_API_URL } from "@/lib/serverApi";
import { MAX_SOUNDS_PER_USER } from "@gooseboard/shared";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main>
        <h1>Gooseboard</h1>
        <a href="/api/auth/signin/discord">Sign in with Discord</a>
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });

  if (!user) {
    return (
      <main>
        <h1>Gooseboard</h1>
        <p>Could not find your account. Try signing in again.</p>
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
      <main>
        <h1>Gooseboard</h1>
        <h2>Choose a server</h2>
        <p>Pick the Discord server this device should play sounds into. The bot must already be invited to it.</p>
        <p>
          Don't see your server below?{" "}
          <a href={buildBotInviteUrl()} target="_blank" rel="noopener noreferrer">
            Add Gooseboard to a server
          </a>{" "}
          you manage, then reload this page.
        </p>

        {error && <p>{error}</p>}

        {!error && eligibleGuilds.length === 0 && (
          <p>No eligible servers found yet.</p>
        )}

        {!error && eligibleGuilds.length > 0 && (
          <form action={setGuildAction}>
            {eligibleGuilds.map((guild) => (
              <label key={guild.id} style={{ display: "block" }}>
                <input type="radio" name="guildId" value={guild.id} required /> {guild.name}
              </label>
            ))}
            <button type="submit">Confirm</button>
          </form>
        )}
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
      throw new Error(body.error ?? "Upload failed");
    }
    revalidatePath("/");
  }

  async function deleteSoundAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await fetch(`${SERVER_URL}/api/sounds/${id}`, { method: "DELETE" });
    revalidatePath("/");
  }

  async function unpairDeviceAction(formData: FormData) {
    "use server";
    const cuid = formData.get("cuid") as string;
    await fetch(`${SERVER_URL}/api/devices/${cuid}/unpair`, { method: "POST" });
    revalidatePath("/");
  }

  return (
    <main>
      <h1>Gooseboard</h1>
      <p>Signed in as {session.user.name}</p>

      <section>
        <h2>
          Sound library ({sounds.length}/{MAX_SOUNDS_PER_USER})
        </h2>
        <ul>
          {sounds.map((sound) => (
            <li key={sound.id}>
              <span style={{ color: sound.color }}>{sound.icon ?? "🔊"} {sound.displayName}</span>
              <audio controls src={`${PUBLIC_API_URL}${sound.audioUrl}`} />
              <form action={deleteSoundAction} style={{ display: "inline" }}>
                <input type="hidden" name="id" value={sound.id} />
                <button type="submit">Delete</button>
              </form>
            </li>
          ))}
        </ul>

        {sounds.length < MAX_SOUNDS_PER_USER && (
          <form action={uploadSoundAction}>
            <input type="text" name="displayName" placeholder="Name" required />
            <input type="color" name="color" defaultValue="#5865F2" required />
            <input type="text" name="icon" placeholder="Icon (emoji, optional)" maxLength={4} />
            <input type="file" name="audio" accept="audio/mpeg,audio/wav,audio/ogg" required />
            <button type="submit">Upload</button>
          </form>
        )}
      </section>

      <section>
        <h2>Devices</h2>
        {devices.length === 0 && <p>No devices paired yet. Scan the QR code on your Gooseboard's screen to pair one.</p>}
        <ul>
          {devices.map((device) => (
            <li key={device.cuid}>
              {device.cuid} — last seen {device.lastSeenAt?.toLocaleString() ?? "never"}
              <form action={unpairDeviceAction} style={{ display: "inline" }}>
                <input type="hidden" name="cuid" value={device.cuid} />
                <button type="submit">Unpair</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
