import pathLib from "node:path";
import type { Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

import process from "node:process";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.js";
import { getDirectory } from "../util.js";
import sequelize from "./index.js";

const dirname = getDirectory(import.meta.url);

/**
 * Build the migration runner for a given database connection.
 *
 * Tests use this to run the migrations against their own connection, without
 * touching the connection the rest of the application shares.
 */
function createUmzug(db: Sequelize) {
  const dialect = db.getDialect();

  return new Umzug({
    // Support both common and dialect-specific migrations
    migrations: {
      glob: [`migrations/*.@(common|${dialect}).@(js|ts)`, { cwd: dirname }],
      resolve: ({ name, path, context }) => {
        const getMigration = async () => import(path as string);
        const nameWithoutExtension = pathLib.parse(path as string).name;

        // adjust the parameters Umzug will
        // pass to migration methods when called
        return {
          // Remove extension of migration names (to avoid double applying between js and ts)
          name: nameWithoutExtension,
          up: async () => {
            const migration = await getMigration();
            await migration.up({ context });
          },
          down: async () => {
            const migration = await getMigration();
            await migration.down({ context });
          },
        };
      },
    },
    context: db.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize: db,
      modelName: "InternalMigrations",
      tableName: "wwl_internal_migrations",
    }),
    // Map winston onto the umzug internal logger version
    logger: {
      info: (message) => logger.info,
      warn: (message) => logger.warn,
      error: (message) => logger.error,
      debug: (message) => logger.info,
    },
  });
}

const umzug = createUmzug(sequelize);

async function up() {
  const pending = await umzug.pending();
  if (pending.length > 0) {
    const migrationNames: Array<string> = Object.values(pending).map(
      (migration) => migration.name,
    );
    logger.info("Applying pending migrations: ", migrationNames);
  } else {
    logger.info("No pending migrations");
  }

  // Checks migrations and run them if they are not already applied. To keep
  // track of the executed migrations, a table (and sequelize model) called SequelizeMeta
  // will be automatically created (if it doesn't exist already) and parsed.
  await umzug.up();
}

let latestMigration: string;
async function getLatestMigration(includeSuffix: boolean): Promise<string> {
  if (latestMigration === undefined) {
    const executed = await umzug.executed();
    latestMigration = executed[executed.length - 1].name;
  }
  if (includeSuffix) {
    return latestMigration;
  }
  return latestMigration.substring(0, latestMigration.lastIndexOf("."));
}

// Detect whether the file is called directly
// TODO: Find a cleaner solution for this and determine whether we even need this
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Can be called via e.g.
  // node dist/db/migrate.js create --name migration-name.ts --skip-verify
  // after npm run build, or the following before building
  // npx node --loader ts-node/esm src/db/migrate.ts create --name migration-name.common.ts --skip-verify
  umzug.runAsCLI();
}

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = typeof umzug._types.migration;

export { createUmzug, umzug, up, getLatestMigration };
