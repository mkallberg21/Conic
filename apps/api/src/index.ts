import { createServer } from "./server.js";
import { config } from "./config.js";

const bootstrap = async (): Promise<void> => {
  const app = await createServer();
  await app.listen({ host: "0.0.0.0", port: config.port });
};

bootstrap().catch((error) => {
  // This keeps startup failures obvious in local and CI logs.
  console.error("Failed to start API", error);
  process.exit(1);
});
