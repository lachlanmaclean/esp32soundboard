import { getServerSession } from "next-auth";
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

export default async function PairPage({ searchParams }: { searchParams: { code?: string } }) {
  const session = await getServerSession(authOptions);
  const pairingCode = searchParams.code;

  if (!session) {
    return (
      <main>
        <h1>Pair your Gooseboard</h1>
        <p>Sign in first to link this device to your account.</p>
        <a href={`/api/auth/signin/discord?callbackUrl=/pair?code=${pairingCode ?? ""}`}>
          Sign in with Discord
        </a>
      </main>
    );
  }

  if (!pairingCode) {
    return (
      <main>
        <h1>Pair your Gooseboard</h1>
        <p>Missing pairing code. Scan the QR code shown on your device.</p>
      </main>
    );
  }

  const user = await prisma.user.findUnique({ where: { discordId: session.user.id ?? "" } });

  if (!user) {
    return (
      <main>
        <h1>Pair your Gooseboard</h1>
        <p>Could not find your account. Try signing in again.</p>
      </main>
    );
  }

  async function submit() {
    "use server";
    await confirmPairing(pairingCode!, user!.id);
  }

  return (
    <main>
      <h1>Pair your Gooseboard</h1>
      <p>Pairing code: {pairingCode}</p>
      <form action={submit}>
        <button type="submit">Confirm pairing</button>
      </form>
    </main>
  );
}
