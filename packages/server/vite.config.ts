import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      // Explicitly specify where to find tests to not run playwright tests
      "tests/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    // Sets up the environment variables shared by all tests before any test
    // module (and therefore src/config.ts) is imported.
    setupFiles: ["./tests/helpers/env.ts"],
    globals: true,
    // Test files share a module registry with the other files running in the
    // same worker, so the server (express app, sequelize, migrations) is
    // imported once per worker instead of once per file. This roughly halves
    // the runtime of the suite.
    //
    // What this asks of a test: it has to work regardless of what ran before
    // it in the same worker. In practice that means creating its own fixtures
    // via tests/helpers/factories.ts (every id is unique, so tests never see
    // each other's data) and restoring anything global it changes -- config
    // values, `global.fetch`, spies. A test that truly needs a pristine
    // database, like tests/migrations.test.ts, creates its own connection.
    isolate: false,
  },
});
