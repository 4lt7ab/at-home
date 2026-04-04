import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = parseInt(process.env.HOME_PORT || "3100", 10);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@domain": path.resolve(__dirname, "../domain"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: port + 2,
    proxy: {
      "/api": `http://localhost:${port}`,
      "/mcp": `http://localhost:${port}`,
      "/ws": {
        target: `ws://localhost:${port}`,
        ws: true,
      },
    },
  },
});
