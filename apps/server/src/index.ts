import { env } from "./env";
import { createApp } from "./api/app";

async function main() {
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[api] listening on :${env.port}`);
  });
}

main().catch((error) => {
  console.error("Fatal error during startup", error);
  process.exit(1);
});
