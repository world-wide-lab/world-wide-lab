import type { Model, ModelStatic } from "sequelize";
import config from "../config.js";
import sequelize from "../db/index.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";
import { getLatestMigration } from "./migrate.js";

const defaultRequestHeaders = {
  "User-Agent": `WWL Replication / ${config.version}`,
};

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

// Name of the model's single primary key attribute. Replication paginates on
// ("updatedAt", primary key), which requires the primary key to be one column.
function getPrimaryKeyAttribute(model: ModelStatic<Model>): string {
  const primaryKeys = model.primaryKeyAttributes;
  if (primaryKeys.length !== 1) {
    throw new Error(
      `Table "${model.tableName}" has ${primaryKeys.length} primary key columns, replication requires exactly one.`,
    );
  }
  return primaryKeys[0];
}

// Name of the database column an attribute is stored in
function getColumnName(model: ModelStatic<Model>, attribute: string): string {
  return model.getAttributes()[attribute]?.field || attribute;
}

// Cast a primary key that arrived as a string (e.g. via a query parameter)
// into the type its column actually uses, so that it compares correctly.
function castPrimaryKey(
  model: ModelStatic<Model>,
  attribute: string,
  value: string,
): number | string {
  const type = model.getAttributes()[attribute]?.type as
    | { key?: string }
    | undefined;

  if (type?.key === "INTEGER" || type?.key === "BIGINT") {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new AppError(
        `Invalid after_id: "${value}" is not a valid value for ${model.tableName}.${attribute}`,
        400,
      );
    }
    return numericValue;
  }
  return value;
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

// Where to continue fetching a table from. The source orders rows by
// ("updatedAt", primary key), so both are needed to identify a row uniquely.
//
// Note that "updatedAt" only has millisecond precision here: it travelled
// through JSON and a JS Date to get here, both of which round to milliseconds.
// If the source stores timestamps more precisely than that (which it does not
// for rows written through sequelize, but can for rows written by hand), the
// cursor points at the start of its millisecond rather than at the exact row,
// and the next page repeats the rows in between. Those repeats are harmless -
// importing is idempotent - and it errs in the safe direction: rows can be
// sent twice, never skipped.
type ReplicationCursor = {
  updatedAt: string;
  id: string;
};

// Retrieve data from the source
async function fetchTableDataFromSource(
  tableName: string,
  limit: number,
  position: { cursor?: ReplicationCursor } | { offset: number },
  lastUpdated?: Date,
) {
  const positionParams: Record<string, string> =
    "offset" in position
      ? { offset: String(position.offset) }
      : position.cursor
        ? {
            after_updated_at: position.cursor.updatedAt,
            after_id: position.cursor.id,
          }
        : {};

  logger.info(
    `Fetching ${tableName} (L:${limit}; ${Object.entries(positionParams)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ")}; U:${lastUpdated})`,
  );

  const search = new URLSearchParams({
    limit: String(limit),
    ...positionParams,
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

// Check whether the source and destination databases are compatible with each
// other and report back what the source is able to do
async function verifyDatabaseVersion(): Promise<{ supportsKeyset: boolean }> {
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

  // Older sources don't announce any capabilities and only understand offsets
  const supportsKeyset =
    sourceInfo?.capabilities?.replication_pagination?.includes("keyset") ===
    true;
  if (!supportsKeyset) {
    logger.warn(
      "Replication source does not support keyset pagination, falling back to offsets. This gets slower the larger the tables are and cannot guarantee a stable order across pages. Consider updating the source instance.",
    );
  }

  return { supportsKeyset };
}

async function replicateTable(tableName: string, supportsKeyset: boolean) {
  const limit = config.replication.chunkSize;
  const model = findModelByTableName(tableName);
  const primaryKey = getPrimaryKeyAttribute(model);
  const lastUpdated = (await model.max("updatedAt")) as Date;

  let offset = 0;
  let cursor: ReplicationCursor | undefined = undefined;
  let rowCount = limit;

  while (rowCount === limit) {
    const tableData = await fetchTableDataFromSource(
      tableName,
      limit,
      supportsKeyset ? { cursor } : { offset },
      lastUpdated,
    );
    rowCount = tableData.length;

    await importTableData(tableName, tableData);

    if (supportsKeyset && rowCount > 0) {
      const lastRow = tableData[rowCount - 1];
      const nextCursor: ReplicationCursor = {
        updatedAt: new Date(lastRow.updatedAt).toISOString(),
        id: String(lastRow[primaryKey]),
      };

      const advanced =
        cursor === undefined ||
        nextCursor.updatedAt !== cursor.updatedAt ||
        nextCursor.id !== cursor.id;

      // A source that ignores the cursor would keep returning the same page
      // forever, so make sure that full pages actually move us forward. A
      // partial page ends the loop below anyway, even if it only repeated
      // rows we had already seen.
      if (!advanced && rowCount === limit) {
        throw new Error(
          `Replication of "${tableName}" is not making any progress, the source keeps returning the same last row (${nextCursor.updatedAt} / ${nextCursor.id}). Either the source is ignoring the cursor, or more than ${limit} rows share a single millisecond of "updatedAt".`,
        );
      }
      cursor = nextCursor;
    }

    offset += limit;
  }
}

// Perform a full replication update across all supported tables
async function runReplication() {
  logger.info("Starting replication");

  // Check whether both databases are compatible
  const { supportsKeyset } = await verifyDatabaseVersion();
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
    await replicateTable(tableName, supportsKeyset);
  }

  logger.info("Finished replication.");
}

export {
  UnknownTableError,
  castPrimaryKey,
  findModelByTableName,
  getColumnName,
  getPrimaryKeyAttribute,
  runReplication,
  getDbVersion,
};
