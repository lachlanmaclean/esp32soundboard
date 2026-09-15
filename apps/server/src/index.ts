import { env } from "./env";
import { createApp } from "./api/app";
import { startBot } from "./bot/client";

async function main() {
  await startBot();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[api] listening on :${env.port}`);
  });
}

main().catch((error) => {
  console.error("Fatal error during startup", error);
  process.exit(1);
});
