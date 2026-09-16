import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVER_URL } from "@/lib/serverApi";

async function confirmPairing(pairingCode: string, userId: string) {
  "use server";

  const res = await fetch(`${SERVER_URL}/api/devices/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode, userId }),
  });

  return res.ok;
}

export default async function PairPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  const pairingCode = searchParams.code;

  if (!session) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">📟</div>
          <h1>Pair your Gooseboard</h1>
          <p>Sign in first to link this device to your account.</p>
          <a
            className="btn btn-primary btn-block"
            href={`/api/auth/signin/discord?callbackUrl=/pair?code=${pairingCode ?? ""}`}
          >
            Sign in with Discord
          </a>
        </div>
      </main>
    );
  }

  if (!pairingCode) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">📟</div>
          <h1>Pair your Gooseboard</h1>
          <p>Missing pairing code. Scan the QR code shown on your device.</p>
        </div>
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id ?? "" } });

  if (!user) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">📟</div>
          <h1>Pair your Gooseboard</h1>
          <p>Could not find your account. Try signing in again.</p>
        </div>
      </main>
    );
  }

  async function submit() {
    "use server";
    const ok = await confirmPairing(pairingCode!, user!.id);

    if (ok) {
      redirect("/board");
    }
    redirect(`/pair?code=${encodeURIComponent(pairingCode!)}&error=${encodeURIComponent("That code is invalid or has expired. Check the device's screen for a new one.")}`);
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">📟</div>
        <h1>Pair your Gooseboard</h1>
        <p>Confirm this pairing code to link the device to your account.</p>
        <div className="code-pill">{pairingCode}</div>
        {searchParams.error && <p className="alert">{searchParams.error}</p>}
        <form action={submit}>
          <button className="btn btn-primary btn-block" type="submit">Confirm pairing</button>
        </form>
      </div>
    </main>
  );
}
