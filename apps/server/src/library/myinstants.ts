import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MYINSTANTS_ORIGIN = "https://www.myinstants.com";

// Plain fetches without a browser User-Agent get a 403 from Cloudflare;
// a normal Chrome UA passes straight through with no JS challenge.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

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
 * Node's own fetch (undici) gets a 403 from Cloudflare here even with a full
 * set of matching browser headers - almost certainly TLS/HTTP client
 * fingerprinting, since an identical request via curl succeeds. Shelling out
 * to curl sidesteps that rather than trying to out-fingerprint Cloudflare.
 */
async function curlGet(url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sS",
        "-A",
        BROWSER_USER_AGENT,
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "-H",
        "Accept-Language: en-US,en;q=0.9",
        "-H",
        `Referer: ${MYINSTANTS_ORIGIN}/`,
        "--fail",
        // Without these, a stalled connection (e.g. outbound blocked from
        // this host) hangs indefinitely - the request then dies to the edge
        // proxy's own timeout instead, which returns an opaque HTML 502
        // with no error detail at all. Failing fast here means a real,
        // loggable error instead.
        "--connect-timeout", "5",
        "--max-time", "10",
        url,
      ],
      // Backstop in case curl itself ignores its own flags - SIGTERM's it
      // rather than letting the request hang the whole process indefinitely.
      { timeout: 12_000 },
    );
    return stdout;
  } catch (error) {
    // Node's execFile error carries curl's own stderr/exit code (and ENOENT
    // specifically means curl itself isn't installed in this container) -
    // log it in full server-side, since the generic "Search failed" the
    // browser sees on its own isn't enough to tell those apart.
    const code = (error as NodeJS.ErrnoException)?.code;
    const stderr = (error as { stderr?: string })?.stderr;
    console.error(`[myinstants] curl request to ${url} failed`, { code, stderr, error });
    throw error;
  }
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
    return parseInstants(await curlGet(url));
  } catch (error) {
    throw new Error(`myinstants search failed: ${error instanceof Error ? error.message : error}`);
  }
}

/** The site's US trending page - same markup as search, just no query. Used for browse/suggestions. */
export async function fetchTrendingMyinstants(): Promise<LibrarySound[]> {
  try {
    return parseInstants(await curlGet(`${MYINSTANTS_ORIGIN}/en/index/us/`));
  } catch (error) {
    throw new Error(`myinstants trending failed: ${error instanceof Error ? error.message : error}`);
  }
}
