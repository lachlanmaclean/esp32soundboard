import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOwnerDiscordId, IMPERSONATE_COOKIE } from "@/lib/currentUser";
import { LATEST_CHANGELOG_VERSION } from "@/lib/changelog";
import { SERVER_URL } from "@/lib/serverApi";
import { AdminRowMenu } from "@/components/AdminRowMenu";

export const metadata = {
  title: "Gooseboard — Admin",
};

function formatAccountAge(createdAt: Date) {
  const days = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function formatVoiceMinutes(sessions: { startedAt: Date; endedAt: Date | null }[]) {
  const totalMs = sessions.reduce((sum, s) => sum + ((s.endedAt ?? new Date()).getTime() - s.startedAt.getTime()), 0);
  return Math.round(totalMs / 60_000);
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isOwnerDiscordId(session.user.id)) {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { sounds: true, presets: true, playEvents: true } },
      voiceSessions: { select: { startedAt: true, endedAt: true } },
    },
  });

  async function setTierAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const tier = formData.get("tier") as "NORMAL" | "PRO";
    await prisma.user.update({ where: { id }, data: { tier } });
    revalidatePath("/admin");
  }

  async function setStatusAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const status = formData.get("status") as "ACTIVE" | "SUSPENDED";
    await prisma.user.update({ where: { id }, data: { status } });
    revalidatePath("/admin");
  }

  async function forceDeleteAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;

    const [sounds, presets] = await Promise.all([
      prisma.sound.findMany({ where: { userId: id }, select: { id: true } }),
      prisma.preset.findMany({ where: { userId: id }, select: { id: true } }),
    ]);

    await Promise.all(presets.map((p) => fetch(`${SERVER_URL}/api/presets/${p.id}`, { method: "DELETE" })));
    await Promise.all(sounds.map((s) => fetch(`${SERVER_URL}/api/sounds/${s.id}`, { method: "DELETE" })));
    revalidatePath("/admin");
  }

  async function toggleChangelogMuteAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const changelogMuted = formData.get("changelogMuted") === "true";
    await prisma.user.update({ where: { id }, data: { changelogMuted } });
    revalidatePath("/admin");
  }

  async function impersonateAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const adminDiscordId = session!.user!.id!;

    await prisma.impersonationLog.create({ data: { adminDiscordId, targetUserId: id } });
    cookies().set(IMPERSONATE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 2 });

    redirect("/");
  }

  return (
    <main className="auth-screen" style={{ alignItems: "flex-start", padding: "32px 16px" }}>
      <div className="auth-card" style={{ maxWidth: 1100, width: "100%", textAlign: "left" }}>
        <a className="btn-link" href="/">← Back to Gooseboard</a>
        <h1>🛠️ Admin</h1>
        <p className="card-subtext">{users.length} users</p>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Age</th>
                <th>Sounds</th>
                <th>Presets</th>
                <th>Plays</th>
                <th>Voice (min)</th>
                <th>Changelog</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-user-cell">
                      {user.discordAvatar ? (
                        <img className="avatar" src={user.discordAvatar} alt="" style={{ width: 28, height: 28 }} />
                      ) : (
                        <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {user.discordUsername.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      {user.discordUsername}
                    </div>
                  </td>
                  <td>
                    <form action={setTierAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="tier" value={user.tier === "PRO" ? "NORMAL" : "PRO"} />
                      <button className={`btn${user.tier === "PRO" ? " btn-primary" : ""}`} type="submit">
                        {user.tier}
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={setStatusAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"}
                      />
                      <button className={`btn${user.status === "SUSPENDED" ? " btn-danger" : ""}`} type="submit">
                        {user.status}
                      </button>
                    </form>
                  </td>
                  <td>{formatAccountAge(user.createdAt)}</td>
                  <td>{user._count.sounds}</td>
                  <td>{user._count.presets}</td>
                  <td>{user._count.playEvents}</td>
                  <td>{formatVoiceMinutes(user.voiceSessions)}</td>
                  <td>
                    <div className="admin-changelog-cell">
                      {user.changelogMuted ? (
                        <span className="card-subtext">🔇 Muted</span>
                      ) : user.lastSeenChangelogVersion === LATEST_CHANGELOG_VERSION ? (
                        <span className="card-subtext">✅ Seen</span>
                      ) : (
                        <span className="card-subtext">❌ Not seen</span>
                      )}
                      <form action={toggleChangelogMuteAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="changelogMuted" value={(!user.changelogMuted).toString()} />
                        <button className="btn" type="submit" title={user.changelogMuted ? "Unmute" : "Mute"}>
                          {user.changelogMuted ? "Unmute" : "Mute"}
                        </button>
                      </form>
                    </div>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <form action={impersonateAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <button className="btn" type="submit">Impersonate</button>
                      </form>
                      <AdminRowMenu userId={user.id} username={user.discordUsername} wipeAction={forceDeleteAction} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
