import { env } from "../env";

const MYINSTANTS_ORIGIN = "https://www.myinstants.com";

export interface LibrarySound {
  name: string;
  mp3Url: string;
  detailUrl: string;
}

// Matches each result's play button (name + /media/sounds/*.mp3 path) up to
// its following detail-page anchor, which sits a few tags later in the same
// markup block:
//   <button onclick="play('/media/sounds/foo.mp3', 'loader-123', 'foo')">
//   <a href="/en/instant/foo/">Foo</a>
const RESULT_PATTERN =
  /onclick="play\('([^']+)',\s*'[^']*',\s*'[^']*'\)"[\s\S]*?<a href="(\/en\/instant\/[^"]+)"[^>]*>([^<]+)<\/a>/g;

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function isMyinstantsAudioUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.origin === MYINSTANTS_ORIGIN && parsed.pathname.startsWith("/media/sounds/");
  } catch {
    return false;
  }
}

/**
 * Both Node's own fetch and plain curl get a flat 403 from Cloudflare here -
 * confirmed to be IP-reputation based (this host's hosting-provider IP),
 * not a header or TLS-fingerprint problem, since curl with fully matching
 * browser headers still gets rejected. FlareSolverr runs an actual headless
 * browser instance and proxies the request through it, which clears
 * Cloudflare's checks the same way a real visitor's browser would.
 */
async function flareGet(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${env.flaresolverrUrl}/v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "request.get", url, maxTimeout: 20_000 }),
      // Comfortably above FlareSolverr's own maxTimeout, so its JSON error
      // (if any) surfaces before this request aborts first.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error(`[myinstants] could not reach flaresolverr for ${url}`, error);
    throw new Error(`could not reach flaresolverr: ${error instanceof Error ? error.message : error}`);
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.status !== "ok") {
    console.error(`[myinstants] flaresolverr request to ${url} failed`, { status: res.status, body });
    throw new Error(`flaresolverr request failed: ${body.message ?? res.status}`);
  }

  return body.solution?.response ?? "";
}

function parseInstants(html: string): LibrarySound[] {
  const results: LibrarySound[] = [];

  for (const match of html.matchAll(RESULT_PATTERN)) {
    const [, mp3Path, detailUrl, name] = match;
    results.push({
      name: decodeEntities(name.trim()),
      mp3Url: `${MYINSTANTS_ORIGIN}${mp3Path}`,
      detailUrl: `${MYINSTANTS_ORIGIN}${detailUrl}`,
    });
  }

  return results;
}

export async function searchMyinstants(query: string): Promise<LibrarySound[]> {
  const url = `${MYINSTANTS_ORIGIN}/en/search/?name=${encodeURIComponent(query)}`;

  try {
    return parseInstants(await flareGet(url));
  } catch (error) {
    throw new Error(`myinstants search failed: ${error instanceof Error ? error.message : error}`);
  }
}

/** The site's US trending page - same markup as search, just no query. Used for browse/suggestions. */
export async function fetchTrendingMyinstants(): Promise<LibrarySound[]> {
  try {
    return parseInstants(await flareGet(`${MYINSTANTS_ORIGIN}/en/index/us/`));
  } catch (error) {
    throw new Error(`myinstants trending failed: ${error instanceof Error ? error.message : error}`);
  }
}
