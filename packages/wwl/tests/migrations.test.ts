// Set up fake environment variables
import "./setup_env";

import sequelize from '../src/db';
import { up, umzug } from '../src/db/migrate';

describe('Database Migrations', () => {
  it('should authenticate to database', async () => {
    await sequelize.authenticate();
  });

  it('should have migrations to apply', async () => {
    const pending = await umzug.pending()
    expect(pending.length).toBeGreaterThan(0)
  });

  it('should run migrations without issues', async () => {
    await up();
  });

  it('should always create the same tables', async () => {
    const tableNames: Array<string> = await sequelize.getQueryInterface().showAllTables()
    expect(tableNames).toMatchSnapshot()
  });

  it('should always create the same table structures', async () => {
    const tableNames: Array<string> = await sequelize.getQueryInterface().showAllTables()

    const tableInfos = await Promise.all(tableNames.map(async (tableName) => {
      const tableInfo = await sequelize.getQueryInterface().describeTable(tableName)
      return tableInfo
    }))
    expect(tableInfos).toMatchSnapshot()
  });

  it('should have tables for all models', async () => {
    expect(await sequelize.models.Study.count()).toBe(0)
    expect(await sequelize.models.Participant.count()).toBe(0)
    expect(await sequelize.models.Run.count()).toBe(0)
    expect(await sequelize.models.Response.count()).toBe(0)
  });

  it('should be in-sync with the models afterwards', async () => {
    // sequelize.sync with alter: false shouldn't fail
    await sequelize.sync({ alter: false });
  });
});