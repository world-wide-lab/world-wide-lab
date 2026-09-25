// Set up fake environment variables
import "./setup_env";

import sequelize from "../src/db";
import { up } from "../src/db/migrate";
import { tablesToReplicate } from "../src/db/replication";

// Tables deliberately not replicated; every table must be replicated or listed here
const tablesNotReplicated = [
  // Internal to a single instance
  "wwl_internal_migrations",
  "wwl_internal_admin_sessions",
  "wwl_internal_instances",
  "wwl_internal_response_payload_keys",
  "wwl_deployments",
  // Not replicated (yet)
  "wwl_leaderboards",
  "wwl_leaderboard_scores",
];

async function getAllTables(): Promise<string[]> {
  const tables = (await sequelize.getQueryInterface().showAllTables()) as Array<
    string | { tableName: string }
  >;
  return tables
    .map((table) => (typeof table === "string" ? table : table.tableName))
    .filter((table) => table.startsWith("wwl_"));
}

async function getForeignKeys(tableName: string) {
  return (await sequelize
    .getQueryInterface()
    .getForeignKeyReferencesForTable(tableName)) as Array<{
    columnName: string;
    referencedTableName: string;
  }>;
}

describe("Replication Coverage", () => {
  beforeAll(async () => {
    // Use the schema as the migrations create it, like a replication destination
    await up();
  });

  it("should either replicate or explicitly exclude every table", async () => {
    const tables = await getAllTables();
    const undecided = tables.filter(
      (table) =>
        !tablesToReplicate.includes(table) &&
        !tablesNotReplicated.includes(table),
    );

    expect(undecided).toEqual([]);
  });

  it("should not list tables which do not exist", async () => {
    const tables = await getAllTables();
    const unknown = [...tablesToReplicate, ...tablesNotReplicated].filter(
      (table) => !tables.includes(table),
    );

    expect(unknown).toEqual([]);
  });

  it("should be able to read foreign keys from the schema", async () => {
    // Guards the next test against passing only because nothing was found
    const foreignKeys = await getForeignKeys("wwl_sessions");
    expect(foreignKeys.map((fk) => fk.referencedTableName)).toContain(
      "wwl_studies",
    );
  });

  it("should replicate every table referenced by a replicated table before it", async () => {
    const problems: string[] = [];

    for (const [index, tableName] of tablesToReplicate.entries()) {
      const columns = await sequelize
        .getQueryInterface()
        .describeTable(tableName);
      for (const foreignKey of await getForeignKeys(tableName)) {
        const referencedIndex = tablesToReplicate.indexOf(
          foreignKey.referencedTableName,
        );
        if (referencedIndex === -1) {
          problems.push(
            `${tableName}.${foreignKey.columnName} references ${foreignKey.referencedTableName}, which is not replicated`,
          );
        } else if (
          referencedIndex >= index &&
          !columns[foreignKey.columnName].allowNull
        ) {
          // Only nullable references can be deferred to the second pass
          problems.push(
            `${tableName}.${foreignKey.columnName} references ${foreignKey.referencedTableName}, which is not replicated before it, and can not be left empty in the meantime`,
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
