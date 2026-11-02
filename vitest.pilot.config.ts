import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("client/src"),
      "@shared": path.resolve("shared"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/domain/**/*.test.ts",
      "server/application/**/*.test.ts",
      "server/http/**/*.test.ts",
      "server/adapters/**/*.test.ts",
      "server/civic/**/*.test.ts",
      "tests/**/*.test.ts",
      "client/src/**/*.test.ts",
      "client/src/**/*.test.tsx",
    ],
    setupFiles: ["tests/isolation-guard.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
