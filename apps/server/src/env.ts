import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  discordBotToken: required("DISCORD_BOT_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordClientSecret: required("DISCORD_CLIENT_SECRET"),
  // Base URL of the Next.js portal, used to build pairing QR code links.
  portalUrl: process.env.PORTAL_URL ?? "http://localhost:3000",
};
