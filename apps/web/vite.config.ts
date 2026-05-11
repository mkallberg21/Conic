import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@conic/domain": path.resolve(currentDir, "../../packages/domain/src")
    }
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173)
  }
});
