import { Router } from "express";
import { searchMyinstants, fetchTrendingMyinstants, isMyinstantsAudioUrl, LibrarySound } from "../../library/myinstants";
import { importMyinstantsSound } from "../../library/import";
import { triggerExternalPlayback, BotProxyError } from "../botClient";
import { recordPlayEvent } from "../../analytics";
import { prisma } from "../../db";
import { LIBRARY_SOUND_LIMIT, PRO_LIBRARY_SOUND_LIMIT } from "@gooseboard/shared";

export const libraryRouter = Router();

// Caches search results per query so the same term typed by any user (or
// re-typed by the same one) doesn't re-hit myinstants.com - keeps us well
// clear of anything Cloudflare might flag as scraping abuse. Capped and
// FIFO-evicted since queries are unbounded, unlike the single trending slot.
const SEARCH_CACHE_MS = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 500;
const searchCache = new Map<string, { results: LibrarySound[]; fetchedAt: number }>();

// Collapses concurrent requests for the same query into a single scrape,
// so a burst of clicks/retypes while a search is in flight can't fan out
// into several simultaneous hits either.
const searchInFlight = new Map<string, Promise<LibrarySound[]>>();

async function searchMyinstantsCached(query: string): Promise<LibrarySound[]> {
  const key = query.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_MS) {
    return cached.results;
  }

  const existing = searchInFlight.get(key);
  if (existing) return existing;

  const promise = searchMyinstants(query)
    .then((results) => {
      if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey !== undefined) searchCache.delete(oldestKey);
      }
      searchCache.set(key, { results, fetchedAt: Date.now() });
      return results;
    })
    .finally(() => searchInFlight.delete(key));

  searchInFlight.set(key, promise);
  return promise;
}

/** Backs the portal's "meme library" search, proxying myinstants.com so the browser never talks to it directly. */
libraryRouter.get("/search", async (req, res) => {
  const query = req.query.q as string | undefined;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "q is required" });
  }

  try {
    const results = await searchMyinstantsCached(query.trim());
    return res.json(results);
  } catch (error) {
    console.error("[library] myinstants search failed", error);
    return res.status(502).json({ error: "Search failed" });
  }
});

// Trending changes slowly enough that re-scraping on every page load is
// pure waste (and exactly the kind of repeated hit Cloudflare might flag) -
// re-scraped at most once a day, persisted in the DB rather than in-process
// memory so it survives restarts/redeploys instead of silently resetting
// to "needs a fresh scrape" every time.
const TRENDING_CACHE_MS = 24 * 60 * 60 * 1000;
const TRENDING_COUNT = 4;
let trendingRefreshInFlight: Promise<LibrarySound[]> | null = null;

async function getTrendingCached(): Promise<LibrarySound[]> {
  const cached = await prisma.trendingCache.findUnique({ where: { id: 1 } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < TRENDING_CACHE_MS) {
    return cached.results as unknown as LibrarySound[];
  }

  // Collapses concurrent requests hitting a stale/missing cache into one
  // scrape instead of each kicking off its own.
  if (trendingRefreshInFlight) return trendingRefreshInFlight;

  trendingRefreshInFlight = fetchTrendingMyinstants()
    .then(async (fresh) => {
      const results = fresh.slice(0, TRENDING_COUNT);
      await prisma.trendingCache.upsert({
        where: { id: 1 },
        create: { id: 1, results: results as object },
        update: { results: results as object, fetchedAt: new Date() },
      });
      return results;
    })
    .catch((error) => {
      console.error("[library] myinstants trending refresh failed", error);
      // Stale is better than nothing - fall back to whatever's cached
      // (even if past its 24h window) rather than erroring the page.
      if (cached) return cached.results as unknown as LibrarySound[];
      throw error;
    })
    .finally(() => {
      trendingRefreshInFlight = null;
    });

  return trendingRefreshInFlight;
}

libraryRouter.get("/trending", async (_req, res) => {
  try {
    const results = await getTrendingCached();
    return res.json(results);
  } catch (error) {
    console.error("[library] myinstants trending failed", error);
    return res.status(502).json({ error: "Trending failed" });
  }
});

/** Plays a myinstants clip straight from its URL - nothing stored in the user's own library. */
libraryRouter.post("/play", async (req, res) => {
  const { userId, mp3Url } = req.body as { userId?: string; mp3Url?: string };
  if (!userId || !mp3Url) {
    return res.status(400).json({ error: "userId and mp3Url are required" });
  }
  if (!isMyinstantsAudioUrl(mp3Url)) {
    return res.status(400).json({ error: "mp3Url must be a myinstants.com sound" });
  }

  try {
    await triggerExternalPlayback(userId, mp3Url);
    recordPlayEvent(userId, null, "WEB");
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof BotProxyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[library] playback failed", error);
    return res.status(500).json({ error: "Playback failed" });
  }
});

/** Downloads a myinstants clip into the user's own library. */
libraryRouter.post("/import", async (req, res) => {
  const { userId, mp3Url, displayName } = req.body as { userId?: string; mp3Url?: string; displayName?: string };
  if (!userId || !mp3Url || !displayName) {
    return res.status(400).json({ error: "userId, mp3Url and displayName are required" });
  }
  if (!isMyinstantsAudioUrl(mp3Url)) {
    return res.status(400).json({ error: "mp3Url must be a myinstants.com sound" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const libraryLimit = user.tier === "PRO" ? PRO_LIBRARY_SOUND_LIMIT : LIBRARY_SOUND_LIMIT;
  const libraryCount = await prisma.sound.count({ where: { userId } });
  if (libraryCount >= libraryLimit) {
    return res.status(409).json({ error: `Library is full (max ${libraryLimit} sounds) - delete one first` });
  }

  try {
    const sound = await importMyinstantsSound(userId, mp3Url, displayName);
    return res.status(201).json(sound);
  } catch (error) {
    console.error("[library] import failed", error);
    return res.status(502).json({ error: "Import failed" });
  }
});
