import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOwnerDiscordId } from "@/lib/currentUser";
import { NewPolicyButton } from "@/components/NewPolicyButton";
import { PolicyRowMenu } from "@/components/PolicyRowMenu";

export const metadata = {
  title: "Gooseboard — Cooldown policies",
};

export default async function CooldownPoliciesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isOwnerDiscordId(session.user.id)) {
    redirect("/");
  }

  const policies = await prisma.cooldownPolicy.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });

  /** Saves every row's fields in one go, plus whichever radio is checked as the new default. */
  async function saveAllPoliciesAction(formData: FormData) {
    "use server";

    await Promise.all(
      policies.map((policy) =>
        prisma.cooldownPolicy.update({
          where: { id: policy.id },
          data: {
            name: (formData.get(`name_${policy.id}`) as string)?.trim() || undefined,
            maxSoundsInWindow: Number(formData.get(`maxSoundsInWindow_${policy.id}`)),
            windowSeconds: Number(formData.get(`windowSeconds_${policy.id}`)),
            cooldownSeconds: Number(formData.get(`cooldownSeconds_${policy.id}`)),
            limitedDurationSeconds: Number(formData.get(`limitedDurationSeconds_${policy.id}`)),
          },
        }),
      ),
    );

    const defaultPolicyId = formData.get("defaultPolicyId") as string | null;
    if (defaultPolicyId) {
      await prisma.$transaction([
        prisma.cooldownPolicy.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
        prisma.cooldownPolicy.update({ where: { id: defaultPolicyId }, data: { isDefault: true } }),
      ]);
    }

    revalidatePath("/admin/policies");
  }

  async function createPolicyAction(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name?.trim()) return;

    const maxSoundsInWindow = formData.get("maxSoundsInWindow");
    await prisma.cooldownPolicy.create({
      data: {
        name: name.trim(),
        maxSoundsInWindow: maxSoundsInWindow === null || maxSoundsInWindow === "" ? 30 : Number(maxSoundsInWindow),
        windowSeconds: Number(formData.get("windowSeconds")) || 60,
        cooldownSeconds: Number(formData.get("cooldownSeconds")) || 30,
        limitedDurationSeconds: Number(formData.get("limitedDurationSeconds")) || 600,
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

  return (
    <main className="auth-screen" style={{ alignItems: "flex-start", padding: "32px 16px" }}>
      <div className="auth-card" style={{ maxWidth: 1100, width: "100%", textAlign: "left" }}>
        <a className="btn-link" href="/admin">← Back to Admin</a>
        <div className="card-header">
          <h1 style={{ margin: 0 }}>⏱️ Cooldown policies</h1>
          <NewPolicyButton action={createPolicyAction} />
        </div>
        <p className="card-subtext">
          Trips once a user plays too many sounds too quickly; while limited, they have to wait between sounds for a
          set stretch of time. The default policy can&apos;t be deleted, only replaced by picking a new one below and
          saving.
        </p>

        <div className="admin-table-wrap">
          <div className="policy-grid">
            <div className="policy-grid-header">
              <span>Name</span>
              <span title="0 = no limit">Max sounds</span>
              <span>Window (s)</span>
              <span>Cooldown (s)</span>
              <span>Limited for (s)</span>
              <span>Default</span>
              <span aria-hidden="true"></span>
            </div>
          </div>

          <form action={saveAllPoliciesAction} className="policy-grid">
            {policies.map((policy) => (
              <div key={policy.id} className="policy-grid-row">
                <input type="text" name={`name_${policy.id}`} defaultValue={policy.name} aria-label={`${policy.name} - name`} />
                <input
                  type="number"
                  name={`maxSoundsInWindow_${policy.id}`}
                  defaultValue={policy.maxSoundsInWindow}
                  min={0}
                  aria-label={`${policy.name} - max sounds (0 = no limit)`}
                />
                <input
                  type="number"
                  name={`windowSeconds_${policy.id}`}
                  defaultValue={policy.windowSeconds}
                  min={1}
                  aria-label={`${policy.name} - window seconds`}
                />
                <input
                  type="number"
                  name={`cooldownSeconds_${policy.id}`}
                  defaultValue={policy.cooldownSeconds}
                  min={0}
                  aria-label={`${policy.name} - cooldown seconds`}
                />
                <input
                  type="number"
                  name={`limitedDurationSeconds_${policy.id}`}
                  defaultValue={policy.limitedDurationSeconds}
                  min={0}
                  aria-label={`${policy.name} - limited duration seconds`}
                />
                <span className="policy-row-radio">
                  <input
                    type="radio"
                    name="defaultPolicyId"
                    value={policy.id}
                    defaultChecked={policy.isDefault}
                    aria-label={`Make ${policy.name} the default policy`}
                  />
                </span>
                <span>
                  {!policy.isDefault && (
                    <PolicyRowMenu policyId={policy.id} policyName={policy.name} deleteAction={deletePolicyAction} />
                  )}
                </span>
              </div>
            ))}

            <button type="submit" className="btn btn-primary" style={{ gridColumn: "1 / -1", margin: "10px" }}>
              💾 Save changes
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
