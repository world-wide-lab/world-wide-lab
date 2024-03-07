import type { Model, ModelStatic } from "sequelize";
import config from "../config";
import sequelize from "../db";
import { logger } from "../logger";
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

  console.log(`Importing ${tableData.length} rows into ${tableName}`);

  await model.bulkCreate(tableData, {
    updateOnDuplicate: getNonPrimaryKeyColumns(model),
  });

  model.getAttributes();
}

// Retrieve data from the source
async function fetchTableDataFromSource(
  tableName: string,
  limit: number,
  offset: number,
) {
  logger.info(`Fetching ${tableName} (L:${limit}; O:${offset})`);

  const model = findModelByTableName(tableName);
  const lastUpdated = (await model.max("updatedAt")) as Date;

  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    ...(lastUpdated && { updated_after: lastUpdated.toISOString() }),
  }).toString();
  const url = `${config.replication.source}/v1/replication/source/get-table/${tableName}/?${search}`;

  logger.verbose(url);
  const result = await fetch(url, {
    method: "get",
    headers: new Headers({
      ...defaultRequestHeaders,
      Authorization: `Bearer ${config.replication.sourceApiKey}`,
    }),
  });

  const tableData = await result.json();

  // Check whether tableData is an array, else throw an error since sth is wrong
  if (Array.isArray(tableData)) {
    return tableData;
  }
  const statusCode = result.status;
  const hasSourceErrorMessage =
    typeof tableData === "object" && tableData.error;
  if (hasSourceErrorMessage || statusCode !== 200) {
    throw new Error(
      `Replication source reported error when fetching data (${statusCode}). Message: '${
        hasSourceErrorMessage ? tableData.error : ""
      }'.`,
    );
  }
  throw new Error(
    `Error fetching data from source. Table data is not an array: ${tableData}.`,
  );
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

async function replicateTable(tableName: string) {
  const limit = config.replication.chunkSize;
  let offset = 0;
  let rowCount = limit;
  while (rowCount == limit) {
    const tableData = await fetchTableDataFromSource(tableName, limit, offset);
    rowCount = tableData.length;

    await importTableData(tableName, tableData);

    offset += limit;
  }
}

// Perform a full replication update across all supported tables
async function runReplication() {
  logger.info("Starting replication");

  // Check whether both databases are compatible
  await verifyDatabaseVersion();
  logger.info("Database versions OK");

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
    await replicateTable(tableName);
  }

  logger.info("Finished replication.");
}

export {
  UnknownTableError,
  findModelByTableName,
  runReplication,
  getDbVersion,
};
