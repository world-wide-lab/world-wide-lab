import { randomUUID } from "node:crypto";
import pg from "pg";

process.env.ADMIN_UI = "false";
process.env.DEFAULT_API_KEY = "jest-key";

// Tests run against an in-memory SQLite database by default. Set
// TEST_DATABASE_URL (e.g. postgresql://user:pass@localhost:5432/postgres) to
// run them against Postgres instead: every test file then gets its own,
// freshly created database, so files stay isolated and can run in parallel.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl?.startsWith("postgres")) {
  const dbName = `wwl_test_${randomUUID().replaceAll("-", "")}`;
  const client = new pg.Client({ connectionString: testDatabaseUrl });
  await client.connect();
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  const url = new URL(testDatabaseUrl);
  url.pathname = `/${dbName}`;
  process.env.DATABASE_URL = url.toString();
} else {
  process.env.DATABASE_URL = testDatabaseUrl ?? "sqlite::memory:";
}
