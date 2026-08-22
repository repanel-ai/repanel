import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Testing Library unmounts between tests by hooking the global `afterEach`;
    // without globals every spec would have to clean up after itself.
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
