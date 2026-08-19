import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Where the API listens in development (its own default port). */
const API_SERVER = "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      // Control-plane routes, addressed under /api with the prefix stripped.
      "/api": {
        target: API_SERVER,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      // The runtime data API, which the API mounts at /runtime and this app
      // reads from under its own name.
      "/runtime": { target: API_SERVER },
    },
  },
  test: {
    environment: "jsdom",
    // Testing Library unmounts between tests by hooking the global `afterEach`.
    globals: true,
  },
});
