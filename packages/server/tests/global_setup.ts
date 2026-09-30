import pg from "pg";

// When running against postgres (see setup_env.ts), every test file creates
// its own "wwl_test_*" database. Drop them again once all tests are done.
async function dropTestDatabases() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl?.startsWith("postgres")) {
    return;
  }

  const client = new pg.Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE 'wwl\\_test\\_%'",
    );
    for (const { datname } of rows) {
      await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  } finally {
    await client.end();
  }
}

export async function setup() {
  // Also clean up after previous runs that were aborted
  await dropTestDatabases();
}

export async function teardown() {
  await dropTestDatabases();
}
