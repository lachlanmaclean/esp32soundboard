-- AlterTable
-- Existing sounds were effectively all "on the board" already (there was no
-- distinction before this migration), so backfill true, then flip the
-- column's default to false for sounds created from here on.
ALTER TABLE "Sound" ADD COLUMN     "onBoard" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Sound" ALTER COLUMN "onBoard" SET DEFAULT false;

-- Existing rows can't have a real hash computed in SQL (the audio bytes live
-- on disk, not in the database) - they get a placeholder that won't collide
-- with any real SHA-256, so they just never retroactively dedupe against
-- each other. New uploads compute and store a real hash going forward.
ALTER TABLE "Sound" ADD COLUMN     "fileHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Sound" ALTER COLUMN "fileHash" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Sound_fileHash_idx" ON "Sound"("fileHash");
