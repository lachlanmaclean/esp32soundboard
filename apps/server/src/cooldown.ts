import { prisma } from "./db";

export class RateLimitError extends Error {}

/**
 * Checked at the top of every playback trigger, regardless of entry point
 * (web, device, meme library, YouTube), so it can't be bypassed by going
 * through a surface that forgets to call it.
 *
 * Two states:
 * - Not currently limited: count plays in the policy's trailing window: if
 *   that's already at or over the cap, trip the limit (set rateLimitedUntil)
 *   and reject this play too - they're clearly over, so this one waits.
 * - Currently limited: still allowed, but only if enough time has passed
 *   since their last play to satisfy the policy's own cooldown spacing.
 *   rateLimitedUntil itself just lapses naturally once it's in the past;
 *   there's no separate "clear the flag" step.
 */
export async function enforceCooldown(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const policy = user.cooldownPolicyId
    ? await prisma.cooldownPolicy.findUnique({ where: { id: user.cooldownPolicyId } })
    : await prisma.cooldownPolicy.findFirst({ where: { isDefault: true } });
  if (!policy) return; // No policy configured at all - fail open rather than block everyone.

  const now = new Date();

  if (user.rateLimitedUntil && user.rateLimitedUntil > now) {
    const lastPlay = await prisma.playEvent.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (lastPlay) {
      const secondsSinceLastPlay = (now.getTime() - lastPlay.createdAt.getTime()) / 1000;
      if (secondsSinceLastPlay < policy.cooldownSeconds) {
        const wait = Math.ceil(policy.cooldownSeconds - secondsSinceLastPlay);
        throw new RateLimitError(`Rate limited - wait ${wait}s between sounds`);
      }
    }
    return;
  }

  const windowStart = new Date(now.getTime() - policy.windowSeconds * 1000);
  const recentCount = await prisma.playEvent.count({ where: { userId, createdAt: { gte: windowStart } } });

  if (recentCount >= policy.maxSoundsInWindow) {
    await prisma.user.update({
      where: { id: userId },
      data: { rateLimitedUntil: new Date(now.getTime() + policy.limitedDurationSeconds * 1000) },
    });
    const minutes = Math.ceil(policy.limitedDurationSeconds / 60);
    throw new RateLimitError(`Too many sounds too fast - rate limited for ${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
}
