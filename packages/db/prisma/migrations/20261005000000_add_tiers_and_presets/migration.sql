-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('NORMAL', 'PRO');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresetSlot" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "soundId" TEXT NOT NULL,

    CONSTRAINT "PresetSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preset_userId_idx" ON "Preset"("userId");

-- CreateIndex
CREATE INDEX "PresetSlot_presetId_idx" ON "PresetSlot"("presetId");

-- CreateIndex
CREATE INDEX "PresetSlot_soundId_idx" ON "PresetSlot"("soundId");

-- CreateIndex
CREATE UNIQUE INDEX "PresetSlot_presetId_position_key" ON "PresetSlot"("presetId", "position");

-- AddForeignKey
ALTER TABLE "Preset" ADD CONSTRAINT "Preset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetSlot" ADD CONSTRAINT "PresetSlot_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetSlot" ADD CONSTRAINT "PresetSlot_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "Sound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: every user who had onBoard sounds gets one active preset
-- ("My Soundboard") seeded with those sounds at sequential positions, so the
-- existing boolean-based board carries over as the first preset instead of
-- silently disappearing.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  u RECORD;
  new_preset_id TEXT;
  s RECORD;
  pos INTEGER;
BEGIN
  FOR u IN SELECT DISTINCT "userId" FROM "Sound" WHERE "onBoard" = true LOOP
    new_preset_id := gen_random_uuid()::text;
    INSERT INTO "Preset" (id, "userId", name, "isActive", "createdAt", "updatedAt")
    VALUES (new_preset_id, u."userId", 'My Soundboard', true, now(), now());

    pos := 0;
    FOR s IN SELECT id FROM "Sound" WHERE "userId" = u."userId" AND "onBoard" = true ORDER BY "createdAt" ASC LOOP
      INSERT INTO "PresetSlot" (id, "presetId", position, "soundId")
      VALUES (gen_random_uuid()::text, new_preset_id, pos, s.id);
      pos := pos + 1;
    END LOOP;
  END LOOP;
END $$;

-- AlterTable: superseded by PresetSlot membership
ALTER TABLE "Sound" DROP COLUMN "onBoard";
