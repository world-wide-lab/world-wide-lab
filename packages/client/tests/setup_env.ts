process.env.PORT = "0";

process.env.ADMIN_UI = "false";
process.env.DATABASE_URL = "sqlite::memory:";
// process.env.DATABASE_URL = `sqlite:test_${new Date().toLocaleString().replaceAll('/','-')}.sqlite`;
process.env.DEFAULT_API_KEY = "jest-key";

process.env.CREATE_LEADERBOARDS = "lb-test";
