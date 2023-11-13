// Set up environment variables for starting a local server
if (process.env.WWL_SERVER_URL === undefined) {
  process.env.PORT = "0";
  process.env.ADMIN_UI = "false";
  process.env.DATABASE_URL = "sqlite::memory:";
  process.env.DEFAULT_API_KEY = "jest-key";
}
