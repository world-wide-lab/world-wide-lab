import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      // Explicitly specify where to find tests to not run playwright tests
      "tests/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    globals: true,
  },
});
