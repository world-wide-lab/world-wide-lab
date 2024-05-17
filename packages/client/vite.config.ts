import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests-playwright/**"],
    globals: true,
  },
});
