// Set up fake environment variables
import "./setup_env";

import sequelize from "../src/db";
import { umzug, up } from "../src/db/migrate";

describe("Database Migrations", () => {
  it("should authenticate to database", async () => {
    await sequelize.authenticate();
  });

  it("should have migrations to apply", async () => {
    const pending = await umzug.pending();
    expect(pending.length).toBeGreaterThan(0);
  });

  it("should session migrations without issues", async () => {
    await up();
  });

  it("should always create the same tables", async () => {
    const tableNames: Array<string> = await sequelize
      .getQueryInterface()
      .showAllTables();
    tableNames.sort();
    expect(tableNames).toMatchSnapshot();
  });

  it("should still enforce primary keys after adding the replication indexes", async () => {
    // The snapshot below reports the primary keys of wwl_studies,
    // wwl_participants and wwl_sessions as "unique": false. That is an
    // artifact of how sequelize derives that flag, not a schema change:
    // describeTable() walks the table's indexes and assigns
    //   data[column].unique = index.unique
    // for every column of every index, so the last index it looks at wins.
    // Its sqlite handleShowIndexesQuery() reverses PRAGMA INDEX_LIST (which
    // is newest first), so "last" means the most recently created index --
    // which is now the composite ("updatedAt", primary key) index used for
    // replication. That index is not unique and it covers the primary key
    // column, so it overwrites the "unique" the table's own
    // sqlite_autoindex had set. Before it existed the newest index only
    // covered "updatedAt", which is why this surfaces now.
    // wwl_responses is unaffected because its INTEGER PRIMARY KEY is a rowid
    // alias and has no autoindex to overwrite in the first place.
    //
    // The constraint itself is untouched, so assert that directly.
    const studyId = "primary-key-uniqueness-check";
    await sequelize.models.Study.create({ studyId });

    await expect(
      sequelize.models.Study.create({ studyId }),
    ).rejects.toThrowError();

    await sequelize.models.Study.destroy({ where: { studyId } });
  });

  it("should always create the same table structures", async () => {
    const tableNames: Array<string> = await sequelize
      .getQueryInterface()
      .showAllTables();
    tableNames.sort();

    const tableInfos = await Promise.all(
      tableNames.map(async (tableName) => {
        const tableInfo = await sequelize
          .getQueryInterface()
          .describeTable(tableName);
        return tableInfo;
      }),
    );
    expect(tableInfos).toMatchSnapshot();
  });

  it("should have tables for all models", async () => {
    expect(await sequelize.models.Study.count()).toBe(0);
    expect(await sequelize.models.Participant.count()).toBe(0);
    expect(await sequelize.models.Session.count()).toBe(0);
    expect(await sequelize.models.Response.count()).toBe(0);
  });

  it("should be in-sync with the models afterwards", async () => {
    // sequelize.sync with alter: false shouldn't fail
    await sequelize.sync({ alter: false });
  });
});
