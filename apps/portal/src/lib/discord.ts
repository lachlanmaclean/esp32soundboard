// View Channel, Send Messages + Embed Links (its welcome/help message), and
// Connect + Speak (joining voice and playing a sound). Nothing more.
const BOT_PERMISSIONS = 1024 | 2048 | 16384 | 1048576 | 2097152;

/** Link that opens Discord's native "add bot to server" picker. */
export function buildBotInviteUrl() {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    scope: "bot applications.commands",
    permissions: String(BOT_PERMISSIONS),
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
