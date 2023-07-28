import { Umzug, SequelizeStorage } from 'umzug';

import sequelize from '.';
import { logger } from '../logger'

const dialect = sequelize.getDialect();

const umzug = new Umzug({
  // Support both common and dialect-specific migrations
  migrations: { glob: [`migrations/*.@(common|${dialect}).@(js|ts)`, { cwd: __dirname }] },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({
    sequelize,
    modelName: 'InternalMigrations',
    tableName: 'wwl_internal_migrations',
  }),
  // Map winston onto the umzug internal logger version
  logger: {
    info: (message) => logger.info,
    warn: (message) => logger.warn,
    error: (message) => logger.error,
    debug: (message) => logger.info,
  },
});

async function up () {
  const pending = await umzug.pending()
  if (pending.length > 0) {
    const migrationNames: Array<string> = Object.values(pending)
      .map(migration => migration.name)
    logger.info("Applying pending migrations: ", migrationNames)
  } else {
    logger.info("No pending migrations")
  }

  // Checks migrations and run them if they are not already applied. To keep
  // track of the executed migrations, a table (and sequelize model) called SequelizeMeta
  // will be automatically created (if it doesn't exist already) and parsed.
  await umzug.up();
}

if (require.main === module) {
  // Can be called via e.g.
  // node dist/db/migrate.js create --name migration-name
  // after npm run build, or the following before building
  // npx ts-node src/db/migrate.js create --name migration-name
  umzug.runAsCLI()
}

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = typeof umzug._types.migration;

export {
  umzug,
  up,
}
