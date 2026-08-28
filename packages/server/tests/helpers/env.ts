// Environment for all server tests.
//
// This file is registered as a vitest `setupFile` (see vite.config.ts), so it
// runs before any test module is imported and before `src/config.ts` reads
// `process.env`. Individual test files therefore no longer need to remember to
// `import "./setup_env"` as their very first statement.
//
// Every value can still be overridden from the outside, which keeps the suite
// usable against e.g. a local postgres via `DATABASE_URL=... npm test`.
function setDefault(key: string, value: string) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// Each test file gets its own module registry (and therefore its own sequelize
// instance), so an in-memory database gives every file a private database for
// free.
setDefault("DATABASE_URL", "sqlite::memory:");
// The admin UI is expensive to build and is covered by the playwright tests.
setDefault("ADMIN_UI", "false");
setDefault("DEFAULT_API_KEY", "test-api-key");
// Building the OpenAPI spec parses every annotated source file and nothing in
// this suite reads the docs.
setDefault("API_DOCS", "false");
// Keep the test output readable: without this every expected-error test case
// prints a full winston error record.
setDefault("LOGGING_LEVEL_CONSOLE", "silent");
setDefault("LOGGING_FILE", "false");
setDefault("LOGGING_HTTP", "false");
setDefault("LOGGING_SQL", "false");
