// Internal URL for the bot/API server, reachable on the Docker network
// (e.g. http://server:4000) — not exposed to the browser.
export const SERVER_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:4000";

// Server's public domain — the browser fetches uploaded audio directly from here.
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
