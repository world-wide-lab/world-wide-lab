import { QueryTypes, Sequelize } from "sequelize";

import sequelize from "../src/db/index.js";
import { up } from "../src/db/migrate.js";
import { defineModels } from "../src/db/models/index.js";

/**
 * The server always creates its schema from the migrations (see `init.ts`),
 * never from `sequelize.sync()`. Tests that set their schema up with `sync()`
 * therefore run against a schema no deployment actually has, and differences
 * between the two go unnoticed.
 *
 * These tests compare both schemas directly, so drift shows up here instead of
 * in production. They use sqlite introspection and are skipped for other
 * dialects.
 */

/**
 * Foreign keys that the models declare but that the migrations never created.
 *
 * These are not cosmetic: without the foreign keys on
 * `wwl_leaderboard_scores`, `POST /leaderboard/:leaderboardId/score` cannot
 * detect an unknown `sessionId` or `leaderboardId` — it reports those by
 * catching a ForeignKeyConstraintError — and so answers 200 instead of the
 * documented 400.
 *
 * Closing the gap needs a migration, so the current state is pinned here:
 * any *new* drift fails the test, and entries can be dropped as gaps get fixed.
 */
const KNOWN_MISSING_FOREIGN_KEYS: Record<string, string[]> = {
  wwl_leaderboard_scores: ["leaderboardId", "sessionId"],
  wwl_leaderboards: ["studyId"],
};

/**
 * Columns whose nullability differs between both schemas. Both are primary
 * keys, which are implicitly NOT NULL, so these differences are harmless.
 */
const KNOWN_NULLABILITY_DIFFERENCES = [
  "wwl_participants.participantId",
  "wwl_sessions.sessionId",
];

interface ForeignKey {
  from: string;
  table: string;
  to: string;
}

async function getTableNames(db: Sequelize): Promise<string[]> {
  const rows = (await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'wwl_%' AND name != 'wwl_internal_migrations' ORDER BY name",
    { type: QueryTypes.SELECT },
  )) as unknown as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

async function getForeignKeys(
  db: Sequelize,
  tableName: string,
): Promise<string[]> {
  const rows = (await db.query(`PRAGMA foreign_key_list(\`${tableName}\`)`, {
    type: QueryTypes.SELECT,
  })) as unknown as ForeignKey[];
  return rows.map((row) => `${row.from} -> ${row.table}.${row.to}`).sort();
}

async function getColumns(db: Sequelize, tableName: string) {
  const description = await db.getQueryInterface().describeTable(tableName);
  return Object.fromEntries(
    Object.entries(description).map(([column, info]) => [
      column,
      {
        type: info.type,
        primaryKey: info.primaryKey,
        ...(KNOWN_NULLABILITY_DIFFERENCES.includes(`${tableName}.${column}`)
          ? {}
          : { allowNull: info.allowNull }),
      },
    ]),
  );
}

describe.skipIf(sequelize.getDialect() !== "sqlite")(
  "Schema parity (migrations vs. models)",
  () => {
    let modelDb: Sequelize;

    beforeAll(async () => {
      // The schema a deployment actually has
      await up();

      // The schema the models describe
      modelDb = new Sequelize({
        dialect: "sqlite",
        storage: ":memory:",
        logging: false,
      });
      defineModels(modelDb);
      await modelDb.sync();
    });

    afterAll(async () => {
      await modelDb?.close();
    });

    it("should define the same tables", async () => {
      expect(await getTableNames(sequelize)).toEqual(
        await getTableNames(modelDb),
      );
    });

    it("should define the same columns for every table", async () => {
      for (const tableName of await getTableNames(modelDb)) {
        expect({
          [tableName]: await getColumns(sequelize, tableName),
        }).toEqual({ [tableName]: await getColumns(modelDb, tableName) });
      }
    });

    it("should not miss any foreign keys beyond the known ones", async () => {
      for (const tableName of await getTableNames(modelDb)) {
        const migrated = await getForeignKeys(sequelize, tableName);
        const declared = await getForeignKeys(modelDb, tableName);

        const missingColumns = declared
          .filter((key) => !migrated.includes(key))
          .map((key) => key.split(" -> ")[0])
          .sort();

        expect({ [tableName]: missingColumns }).toEqual({
          [tableName]: KNOWN_MISSING_FOREIGN_KEYS[tableName] ?? [],
        });
      }
    });
  },
);
