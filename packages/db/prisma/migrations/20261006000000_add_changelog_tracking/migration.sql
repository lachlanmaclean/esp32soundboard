-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenChangelogVersion" TEXT;
ALTER TABLE "User" ADD COLUMN     "changelogMuted" BOOLEAN NOT NULL DEFAULT false;
