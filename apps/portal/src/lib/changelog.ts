export interface ChangelogEntry {
  /** Bump this whenever a new entry is added - it's what gates re-showing the popup. */
  version: string;
  date: string;
  title: string;
  items: string[];
}

// Newest first. Add a new entry (and bump the version) for anything worth
// surfacing to users on next login - not every commit, just the releases
// that change what they see or can do.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026-10-06",
    date: "October 2026",
    title: "Presets, Pro tier, and YouTube playback",
    items: [
      "Soundboard Designer: save multiple named presets, switch which one is active on your paired device",
      "Pro accounts: more library space, YouTube audio playback (/play in Discord or paste a link on the web), and a bigger soundboard",
      "Sound library, Meme library and Devices are now their own pages instead of one long dashboard",
    ],
  },
];

export const LATEST_CHANGELOG_VERSION = CHANGELOG[0].version;

/** Whether the changelog popup should show for this user - used both to render it and, server-side, to drive the admin page's "seen" column. */
export function shouldShowChangelog(user: { lastSeenChangelogVersion: string | null; changelogMuted: boolean }) {
  return !user.changelogMuted && user.lastSeenChangelogVersion !== LATEST_CHANGELOG_VERSION;
}
