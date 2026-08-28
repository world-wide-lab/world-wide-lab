process.env.PORT = "0";

process.env.ADMIN_UI = "false";
process.env.DATABASE_URL = "sqlite::memory:";
// process.env.DATABASE_URL = `sqlite:test_${new Date().toLocaleString().replaceAll('/','-')}.sqlite`;
process.env.DEFAULT_API_KEY = "jest-key";

process.env.CREATE_LEADERBOARDS = "lb-test";

// Keep the test output readable
process.env.API_DOCS = "false";
process.env.LOGGING_LEVEL_CONSOLE = "silent";
process.env.LOGGING_FILE = "false";
process.env.LOGGING_HTTP = "false";
process.env.LOGGING_SQL = "false";
