import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveEffectiveUser, isOwnerDiscordId } from "@/lib/currentUser";
import { shouldShowChangelog } from "@/lib/changelog";
import { SERVER_URL } from "@/lib/serverApi";
import { Shell } from "@/components/Shell";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";

export const metadata = {
  title: "Gooseboard — Devices",
};

export default async function DevicesPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">📟</div>
          <h1>Gooseboard</h1>
          <p>Sign in with Discord to manage your devices.</p>
          <a className="btn btn-primary btn-block" href="/api/auth/signin/discord?callbackUrl=/devices">
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
          <div className="auth-logo">📟</div>
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
          <div className="auth-logo">📟</div>
          <h1>Pro feature</h1>
          <p>Pairing a physical Gooseboard is a Pro feature.</p>
        </div>
      </main>
    );
  }

  const devices = await prisma.device.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });

  async function unpairDeviceAction(formData: FormData) {
    "use server";
    const cuid = formData.get("cuid") as string;
    const res = await fetch(`${SERVER_URL}/api/devices/${cuid}/unpair`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      redirect(`/devices?error=${encodeURIComponent(body.error ?? `Couldn't unpair that device (${res.status})`)}`);
    }
    revalidatePath("/devices");
  }

  return (
    <Shell
      userName={user.discordUsername}
      userImage={user.discordAvatar}
      title="Devices"
      titleIcon="📟"
      tier={user.tier}
      isImpersonating={isImpersonating}
      isOwner={!isImpersonating && isOwnerDiscordId(session.user.id)}
      showChangelog={shouldShowChangelog(user)}
    >
      <QueryErrorBanner error={searchParams.error} />
      <section className="card">
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
