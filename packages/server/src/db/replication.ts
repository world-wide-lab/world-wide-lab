import type { Model, ModelStatic } from "sequelize";
import config from "../config.js";
import sequelize from "../db/index.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";
import { getLatestMigration } from "./migrate.js";

const defaultRequestHeaders = {
  "User-Agent": `WWL Replication / ${config.version}`,
};

// The tables to replicate, in order. A table has to come after every table it
// references, since rows are imported table by table. The only exceptions are
// nullable references back into the table itself or further down this list,
// which are set in a second pass (see getDeferredColumns).
const tablesToReplicate = [
  "wwl_studies",
  "wwl_participants",
  "wwl_sessions",
  "wwl_item_pools",
  "wwl_items",
  "wwl_item_draws",
  "wwl_responses",
];

class UnknownTableError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = "UnknownTableError";
  }
}

function findModelByTableName(tableName: string): ModelStatic<Model> {
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

// A reference which could not be set while its row was imported, to be set
// once every table has been replicated
interface DeferredLink {
  where: { [column: string]: unknown };
  values: { [column: string]: unknown };
}

// Columns which reference the table itself or a table that is replicated after
// it. Their rows may not exist yet while a chunk is imported (e.g. an item's
// parent, which was updated more recently than the item and therefore comes in
// a later chunk), so these columns are filled in after all tables are done.
async function getDeferredColumns(tableName: string): Promise<string[]> {
  const position = tablesToReplicate.indexOf(tableName);
  const foreignKeys = (await sequelize
    .getQueryInterface()
    .getForeignKeyReferencesForTable(tableName)) as Array<{
    columnName: string;
    referencedTableName: string;
  }>;
  return foreignKeys
    .filter(
      (foreignKey) =>
        tablesToReplicate.indexOf(foreignKey.referencedTableName) >= position,
    )
    .map((foreignKey) => foreignKey.columnName);
}

// Import table data into the database
async function importTableData(
  tableName: string,
  tableData: any[],
  deferredColumns: string[],
): Promise<DeferredLink[]> {
  const model = findModelByTableName(tableName);

  console.log(`Importing ${tableData.length} rows into ${tableName}`);

  const deferredLinks: DeferredLink[] = [];
  const rows = tableData.map((row) => {
    const values: DeferredLink["values"] = {};
    for (const column of deferredColumns) {
      if (row[column] !== null && row[column] !== undefined) {
        values[column] = row[column];
      }
    }
    if (Object.keys(values).length === 0) {
      return row;
    }

    const where: DeferredLink["where"] = {};
    for (const column of model.primaryKeyAttributes) {
      where[column] = row[column];
    }
    deferredLinks.push({ where, values });

    const rowWithoutLinks = { ...row };
    for (const column of Object.keys(values)) {
      rowWithoutLinks[column] = null;
    }
    return rowWithoutLinks;
  });

  await model.bulkCreate(rows, {
    // Rows which already exist keep their links until they are set again
    updateOnDuplicate: getNonPrimaryKeyColumns(model).filter(
      (column) => !deferredColumns.includes(column),
    ),
  });

  return deferredLinks;
}

async function importDeferredLinks(
  tableName: string,
  deferredLinks: DeferredLink[],
) {
  const model = findModelByTableName(tableName);

  console.log(`Linking ${deferredLinks.length} rows in ${tableName}`);

  for (const { where, values } of deferredLinks) {
    // Silent, since updatedAt has to stay the source's value, as it decides
    // what the next replication fetches
    await model.update(values, { where, silent: true });
  }
}

// Retrieve data from the source
async function fetchTableDataFromSource(
  tableName: string,
  limit: number,
  offset: number,
  lastUpdated?: Date,
) {
  logger.info(
    `Fetching ${tableName} (L:${limit}; O:${offset}; U:${lastUpdated})`,
  );

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

async function replicateTable(tableName: string): Promise<DeferredLink[]> {
  const limit = config.replication.chunkSize;
  const model = findModelByTableName(tableName);
  const lastUpdated = (await model.max("updatedAt")) as Date;
  const deferredColumns = await getDeferredColumns(tableName);
  const deferredLinks: DeferredLink[] = [];

  let offset = 0;
  let rowCount = limit;

  while (rowCount === limit) {
    const tableData = await fetchTableDataFromSource(
      tableName,
      limit,
      offset,
      lastUpdated,
    );
    rowCount = tableData.length;

    deferredLinks.push(
      ...(await importTableData(tableName, tableData, deferredColumns)),
    );

    offset += limit;
  }

  return deferredLinks;
}

// Perform a full replication update across all supported tables
async function runReplication() {
  logger.info("Starting replication");

  // Check whether both databases are compatible
  await verifyDatabaseVersion();
  logger.info("Database versions OK");

  // Replicate each database table one by one
  const deferredLinks = new Map<string, DeferredLink[]>();
  for (const tableName of tablesToReplicate) {
    deferredLinks.set(tableName, await replicateTable(tableName));
  }

  // Every row exists now, so the links which had to wait can be set
  for (const [tableName, links] of deferredLinks) {
    if (links.length > 0) {
      await importDeferredLinks(tableName, links);
    }
  }

  logger.info("Finished replication.");
}

export {
  UnknownTableError,
  findModelByTableName,
  runReplication,
  getDbVersion,
  tablesToReplicate,
};
