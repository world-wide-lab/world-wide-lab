// Set up environment variables for starting a local server.
// When WWL_SERVER_URL is set the tests run against an already running server
// and none of this applies.
if (process.env.WWL_SERVER_URL === undefined) {
  process.env.PORT = "0";
  process.env.ADMIN_UI = "false";
  process.env.API_DOCS = "false";
  process.env.DATABASE_URL = "sqlite::memory:";
  process.env.DEFAULT_API_KEY = "jest-key";
  // Keep the test output readable
  process.env.LOGGING_LEVEL_CONSOLE = "silent";
  process.env.LOGGING_FILE = "false";
  process.env.LOGGING_HTTP = "false";
  process.env.LOGGING_SQL = "false";
}
