-- CreateTable
CREATE TABLE "CooldownPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxSoundsInWindow" INTEGER NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL,
    "limitedDurationSeconds" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooldownPolicy_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cooldownPolicyId" TEXT;
ALTER TABLE "User" ADD COLUMN     "rateLimitedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_cooldownPolicyId_idx" ON "User"("cooldownPolicyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cooldownPolicyId_fkey" FOREIGN KEY ("cooldownPolicyId") REFERENCES "CooldownPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the default policy: 30 sounds / 60s trips a 30s between-sounds
-- cooldown for 10 minutes. Every existing user is backfilled onto it, same
-- as a new signup would be.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  default_policy_id TEXT;
BEGIN
  default_policy_id := gen_random_uuid()::text;

  INSERT INTO "CooldownPolicy" (id, name, "maxSoundsInWindow", "windowSeconds", "cooldownSeconds", "limitedDurationSeconds", "isDefault", "createdAt", "updatedAt")
  VALUES (default_policy_id, 'Default', 30, 60, 30, 600, true, now(), now());

  UPDATE "User" SET "cooldownPolicyId" = default_policy_id WHERE "cooldownPolicyId" IS NULL;
END $$;
