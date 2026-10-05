-- CreateTable
CREATE TABLE "TrendingCache" (
    "id" INTEGER NOT NULL,
    "results" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingCache_pkey" PRIMARY KEY ("id")
);
