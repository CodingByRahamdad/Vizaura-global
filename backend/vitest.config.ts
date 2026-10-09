import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup/env.ts"],
    // Integration tests share one test database and truncate it between
    // tests; running them concurrently would race. Sequential execution
    // trades speed for correctness here, matching the MVP scope.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
