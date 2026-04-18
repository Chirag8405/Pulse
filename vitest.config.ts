import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 75,
        lines: 75,
        functions: 75,
        branches: 65,
      },
      exclude: [
        "node_modules/**",
        "e2e/**",
        "**/*.config.ts",
        "src/test/**",
        "src/lib/firebase/**",
        "src/constants/teams.ts",
        "src/app/showcase/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "server-only": resolve(__dirname, "./src/test/server-only.ts"),
    },
  },
});
