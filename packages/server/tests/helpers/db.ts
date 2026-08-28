import type { Sequelize } from "sequelize";

import sequelize from "../../src/db/index.js";
import { up } from "../../src/db/migrate.js";

// Tables in an order that is safe to delete from (children before parents).
const TABLES_IN_DELETION_ORDER = [
  "LeaderboardScore",
  "Response",
  "Session",
  "Leaderboard",
  "Participant",
  "Study",
  "Instance",
  "Deployment",
] as const;

let migrations: Promise<unknown> | undefined;

/**
 * Bring the database of the current test file up to date.
 *
 * Vitest gives every test file its own module registry, which means every test
 * file also gets its own sequelize instance and (with the default
 * `sqlite::memory:`) its own private database. Calling this more than once
 * within a file is cheap: the migrations only ever run once.
 */
async function useTestDatabase(): Promise<Sequelize> {
  if (migrations === undefined) {
    migrations = up();
  }
  await migrations;
  return sequelize;
}

/**
 * Remove all data, but keep the schema.
 *
 * Tests should generally not need this: prefer creating uniquely named
 * fixtures via `tests/helpers/factories.ts`, which keeps tests independent
 * without paying for a database reset. Use this only for tests that assert on
 * global state, such as "how many studies exist in total".
 */
async function resetDatabase(): Promise<void> {
  await useTestDatabase();
  for (const modelName of TABLES_IN_DELETION_ORDER) {
    await sequelize.models[modelName].destroy({ where: {}, force: true });
  }
}

export { resetDatabase, useTestDatabase };
