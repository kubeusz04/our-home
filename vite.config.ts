import { collaborationPlugin } from "./server/vitePlugin.ts";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), collaborationPlugin()],
  server: { host: "0.0.0.0", allowedHosts: [".trycloudflare.com"] },
  test: { include: ["src/**/*.test.ts"] },
  build: { chunkSizeWarningLimit: 1600 },
});
