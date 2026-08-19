import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Where the API listens in development (its own default port). */
const API_SERVER = "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API mounts its routes at the root. The console addresses them under
    // /api and the prefix is stripped here, so one origin serves both in
    // development and the session cookie has nothing to cross.
    proxy: {
      "/api": {
        target: API_SERVER,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    // Testing Library unmounts between tests by hooking the global `afterEach`.
    globals: true,
  },
});
