import type { ModelStatic, Model } from "sequelize";
import config from "../config";
import sequelize from "../db";
import { getLatestMigration } from "./migrate";

const defaultRequestHeaders = {
  "User-Agent": `WWL Replication / ${config.version}`,
};

class UnknownTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownTableError";
  }
}

function findModelByTableName(tableName: string) {
  const model = Object.values(sequelize.models).filter(
    (model) => model.tableName === tableName,
  )[0];

  if (!model) {
    throw new UnknownTableError(`Table "${tableName}" not found`);
  }
  return model;
}

function getNonPrimaryKeyColumns(model: ModelStatic<Model>): string[] {
  const attributes = model.getAttributes();
  const nonPrimaryKeyColumns: string[] = [];
  for (const attr in attributes) {
    if (!attributes[attr].primaryKey) {
      nonPrimaryKeyColumns.push(attr);
    }
  }
  return nonPrimaryKeyColumns;
}

// Import table data into the database
async function importTableData(tableName: string, tableData: any[]) {
  const model = findModelByTableName(tableName);

  await model.bulkCreate(tableData, {
    updateOnDuplicate: getNonPrimaryKeyColumns(model),
  });

  model.getAttributes();
}

// Retrieve data from the source
async function fetchTableDataFromSource(tableName: string) {
  const model = findModelByTableName(tableName);
  const lastUpdated = (await model.max("updatedAt")) as Date;

  const result = await fetch(
    `${config.replication.source}/v1/replication/source/get-table/${tableName}/?` +
      new URLSearchParams({
        limit: String(config.replication.chunkSize),
        updated_after: lastUpdated.toISOString(),
      }),
    {
      method: "get",
      headers: new Headers({
        ...defaultRequestHeaders,
        Authorization: `Basic ${config.replication.source}`,
      }),
    },
  );

  return result.json();
}

// Get a version identifier for the database
// Curerntly this corresponds to the name of the latest applied migration
// This version is used to check whether the source and destination databases are compatible
async function getDbVersion(): Promise<string> {
  return await getLatestMigration(false);
}

// Check whether the source and destination databases are compatible with each other
async function verifyDatabaseVersion() {
  const result = await fetch(`${config.replication.source}/v1/info`, {
    method: "get",
    headers: new Headers({ ...defaultRequestHeaders }),
  });
  const sourceInfo = await result.json();
  const sourceDbVersion = sourceInfo.db_version;
  const destinationDbVersion = await getDbVersion();

  if (sourceDbVersion !== destinationDbVersion) {
    throw new Error(
      `Database version mismatch. Source: ${sourceDbVersion}, Destination: ${destinationDbVersion} (this machine).`,
    );
  }
}

// Perform a full replication update across all supported tables
async function runReplication() {
  // Check whether both databases are compatible
  await verifyDatabaseVersion();

  const tablesToReplicate = [
    // sequelize.models.Study.tableName,
    // sequelize.models.Participant.tableName,
    // sequelize.models.Session.tableName,
    // sequelize.models.Responses.tableName,
    "wwl_studies",
    "wwl_participants",
    "wwl_sessions",
    "wwl_responses",
  ];

  // Replicate each database table one by one
  for (const tableName of tablesToReplicate) {
    const tableData = await fetchTableDataFromSource(tableName);
    await importTableData(tableName, tableData);
  }
}

export {
  UnknownTableError,
  findModelByTableName,
  runReplication,
  getDbVersion,
};
