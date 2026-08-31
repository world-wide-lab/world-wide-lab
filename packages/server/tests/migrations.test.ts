import { Sequelize } from "sequelize";

import { createUmzug } from "../src/db/migrate";
import { defineModels } from "../src/db/models/index.js";

// This test needs a database that has never been migrated, so it brings its own
// connection instead of using the one the rest of the application shares.
describe("Database Migrations", () => {
  let db: Sequelize;
  let umzug: ReturnType<typeof createUmzug>;

  beforeAll(() => {
    db = new Sequelize({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    });
    defineModels(db);
    umzug = createUmzug(db);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("should authenticate to database", async () => {
    await db.authenticate();
  });

  it("should have migrations to apply", async () => {
    const pending = await umzug.pending();
    expect(pending.length).toBeGreaterThan(0);
  });

  it("should run migrations without issues", async () => {
    await umzug.up();

    expect((await umzug.pending()).length).toBe(0);
  });

  it("should always create the same tables", async () => {
    const tableNames: Array<string> = await db
      .getQueryInterface()
      .showAllTables();
    tableNames.sort();
    expect(tableNames).toMatchSnapshot();
  });

  it("should always create the same table structures", async () => {
    const tableNames: Array<string> = await db
      .getQueryInterface()
      .showAllTables();
    tableNames.sort();

    const tableInfos = await Promise.all(
      tableNames.map(async (tableName) => {
        return await db.getQueryInterface().describeTable(tableName);
      }),
    );
    expect(tableInfos).toMatchSnapshot();
  });

  it("should have tables for all models", async () => {
    expect(await db.models.Study.count()).toBe(0);
    expect(await db.models.Participant.count()).toBe(0);
    expect(await db.models.Session.count()).toBe(0);
    expect(await db.models.Response.count()).toBe(0);
  });

  it("should be in-sync with the models afterwards", async () => {
    // sequelize.sync with alter: false shouldn't fail
    await db.sync({ alter: false });
  });
});
