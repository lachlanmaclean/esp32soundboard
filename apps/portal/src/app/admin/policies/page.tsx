import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOwnerDiscordId } from "@/lib/currentUser";
import { NewPolicyRow } from "@/components/NewPolicyRow";

export const metadata = {
  title: "Gooseboard — Cooldown policies",
};

export default async function CooldownPoliciesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isOwnerDiscordId(session.user.id)) {
    redirect("/");
  }

  const policies = await prisma.cooldownPolicy.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });

  async function createPolicyAction(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name?.trim()) return;

    await prisma.cooldownPolicy.create({
      data: {
        name: name.trim(),
        maxSoundsInWindow: Number(formData.get("maxSoundsInWindow")) || 30,
        windowSeconds: Number(formData.get("windowSeconds")) || 60,
        cooldownSeconds: Number(formData.get("cooldownSeconds")) || 30,
        limitedDurationSeconds: Number(formData.get("limitedDurationSeconds")) || 600,
      },
    });
    revalidatePath("/admin/policies");
  }

  async function updatePolicyAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;

    await prisma.cooldownPolicy.update({
      where: { id },
      data: {
        name: name?.trim() || undefined,
        maxSoundsInWindow: Number(formData.get("maxSoundsInWindow")),
        windowSeconds: Number(formData.get("windowSeconds")),
        cooldownSeconds: Number(formData.get("cooldownSeconds")),
        limitedDurationSeconds: Number(formData.get("limitedDurationSeconds")),
      },
    });
    revalidatePath("/admin/policies");
  }

  async function deletePolicyAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;

    const policy = await prisma.cooldownPolicy.findUnique({ where: { id } });
    if (!policy || policy.isDefault) return; // The default policy can never be deleted.

    await prisma.cooldownPolicy.delete({ where: { id } });
    revalidatePath("/admin/policies");
  }

  async function setDefaultPolicyAction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;

    await prisma.$transaction([
      prisma.cooldownPolicy.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      prisma.cooldownPolicy.update({ where: { id }, data: { isDefault: true } }),
    ]);
    revalidatePath("/admin/policies");
  }

  return (
    <main className="auth-screen" style={{ alignItems: "flex-start", padding: "32px 16px" }}>
      <div className="auth-card" style={{ maxWidth: 1000, width: "100%", textAlign: "left" }}>
        <a className="btn-link" href="/admin">← Back to Admin</a>
        <h1>⏱️ Cooldown policies</h1>
        <p className="card-subtext">
          Trips once a user plays {"maxSoundsInWindow"} sounds within {"windowSeconds"}s; while limited, they must
          wait {"cooldownSeconds"}s between sounds, for {"limitedDurationSeconds"}s total. The default policy can&apos;t
          be deleted, only replaced by promoting another one.
        </p>

        <div className="admin-table-wrap">
          <div className="policy-grid">
            <div className="policy-grid-header">
              <span>Name</span>
              <span>Max sounds</span>
              <span>Window (s)</span>
              <span>Cooldown (s)</span>
              <span>Limited for (s)</span>
              <span>Default</span>
              <span>Actions</span>
            </div>

            {policies.map((policy) => (
              <form key={policy.id} action={updatePolicyAction} className="policy-grid-row">
                <input type="hidden" name="id" value={policy.id} />
                <input type="text" name="name" defaultValue={policy.name} />
                <input type="number" name="maxSoundsInWindow" defaultValue={policy.maxSoundsInWindow} min={1} />
                <input type="number" name="windowSeconds" defaultValue={policy.windowSeconds} min={1} />
                <input type="number" name="cooldownSeconds" defaultValue={policy.cooldownSeconds} min={0} />
                <input
                  type="number"
                  name="limitedDurationSeconds"
                  defaultValue={policy.limitedDurationSeconds}
                  min={0}
                />
                <span className="policy-row-default">{policy.isDefault ? "✅ Default" : ""}</span>
                <span className="admin-actions">
                  <button className="btn" type="submit">Save</button>
                  {!policy.isDefault && (
                    <button
                      className="btn"
                      type="submit"
                      formAction={setDefaultPolicyAction}
                      title="Make this the default policy"
                    >
                      Set default
                    </button>
                  )}
                  {!policy.isDefault && (
                    <button className="btn btn-danger" type="submit" formAction={deletePolicyAction} title="Delete">
                      Delete
                    </button>
                  )}
                </span>
              </form>
            ))}

            <NewPolicyRow action={createPolicyAction} />
          </div>
        </div>
      </div>
    </main>
  );
}
