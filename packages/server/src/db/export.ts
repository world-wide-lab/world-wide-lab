import type { Response } from "express";
import { json2csv } from "json-2-csv";
import { QueryTypes, type Sequelize } from "sequelize";
import config from "../config.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";

type ExportFormat = "json" | "csv";

// Value used to continue keyset pagination after a given row. Cursors have to
// be unique and strictly increasing across the pages of an export.
type Cursor = number | string;

// Retrieve one page of data, starting after the given cursor. The cursor is
// undefined for the very first page.
type PageQuery = (
  cursor: Cursor | undefined,
  limit: number,
) => Promise<object[]>;

// Column alias used to carry the keyset cursor of a row in raw SQL exports.
// It is removed from the data before it is sent to the user, so that a payload
// key with the same name as the cursor's column can never shadow it.
const KEYSET_CURSOR_COLUMN = "__wwl_keyset_cursor";

// Create the callbacks used to stream a data export to an express response.
// Data is written in chunks, so that exports do not have to be held in memory
// in their entirety.
function createExportWriter(res: Response, format: ExportFormat) {
  if (format !== "json" && format !== "csv") {
    throw new Error(`Unknown format: ${format}`);
  }

  let isFirstChunk = true;

  const onStart = () => {
    if (format === "json") {
      res.status(200).contentType("application/json");

      res.write("[");
    } else if (format === "csv") {
      res.status(200).contentType("text/csv");
    }
    res.write("");
  };

  // Process & return each chunk of data
  const onData = async (data: object[]) => {
    if (format === "json") {
      // Convert data to JSON string
      const json = JSON.stringify(data);

      if (!isFirstChunk) {
        // Add comma in between JSON chunks
        res.write(",");
      }

      // Remove first and last characters from JSON string
      // They should be "[" and "]" respectively.
      // Since we want to combine data from multiple chunks, we have to
      // remove them within every chunk and only add them once in
      // onStart and onEnd.
      res.write(json.substring(1, json.length - 1));
    } else if (format === "csv") {
      if (!isFirstChunk) {
        // Add newline in between CSV chunks
        res.write("\n");
      }

      // Convert to CSV
      res.write(
        json2csv(data, {
          prependHeader: isFirstChunk,
          expandNestedObjects: false,
          useDateIso8601Format: true,
        }),
      );
    }

    isFirstChunk = false;
  };

  // Complete the data export
  const onEnd = () => {
    if (format === "json") {
      res.write("]");
    }

    // Mark the response as finished
    res.end();
  };

  return { onStart, onData, onEnd };
}

// Export data from the database in chunks, using offset-based pagination.
// Prefer keysetExport() where possible, see keysetQuery() for why.
async function paginatedExport(
  res: Response,
  queryData: (offset: number, limit: number) => Promise<object[]>,
  format: ExportFormat,
  limit: number = Number.POSITIVE_INFINITY,
  initialOffset = 0,
) {
  const { onStart, onData, onEnd } = createExportWriter(res, format);

  return await chunkedQuery({
    queryData,
    onData,
    onStart,
    onEnd,
    limit,
    initialOffset,
  });
}

// Export data from the database in chunks, using keyset pagination
async function keysetExport(
  res: Response,
  queryPage: PageQuery,
  format: ExportFormat,
  options: { cursorField: string; hideCursorField?: boolean },
) {
  const { onStart, onData, onEnd } = createExportWriter(res, format);

  return await keysetQuery({
    queryPage,
    onData,
    onStart,
    onEnd,
    ...options,
  });
}

async function chunkedQuery({
  queryData,
  onData,
  onStart = () => {},
  onEnd = () => {},
  limit = Number.POSITIVE_INFINITY,
  initialOffset = 0,
}: {
  queryData: (offset: number, limit: number) => Promise<object[]>;
  onData: (data: object[]) => Promise<void>;
  onStart?: () => void;
  onEnd?: () => void;
  limit?: number;
  initialOffset?: number;
}) {
  let pageSize = config.database.chunkSize;
  let offset = initialOffset;
  const absoluteLimit = initialOffset + limit;

  let nRowsResult: number;
  let isFirstIteration = true;
  if (limit < pageSize) {
    pageSize = limit;
  }

  do {
    // If we'd overshoot with the next page, reduce the page size to exactly fit the limit
    if (offset + pageSize > absoluteLimit) {
      pageSize = absoluteLimit - offset;
    }

    // Retrieve the data
    const data = await queryData(offset, pageSize);
    if (!Array.isArray(data)) {
      throw new Error("Data is always expected to be returned as an Array");
    }
    nRowsResult = data.length;

    if (isFirstIteration) {
      // Call onStart after we received data for the first time to still allow
      // sending error status codes if query code fails.
      onStart();
      isFirstIteration = false;
    }

    if (nRowsResult > pageSize) {
      logger.warn(
        `Query returned more rows (${nRowsResult}) than the page size (${pageSize}). This will lead to a premature exit.`,
      );
    }

    // Do something with the data (usually returning it to the user)
    if (nRowsResult > 0) {
      await onData(data);
    }

    // Increase the offset in case we will continue
    offset += pageSize;

    // Check whether we already got all data
    // e.g. we either got an empty result or our result was less than the limit
  } while (
    nRowsResult > 0 &&
    nRowsResult === pageSize &&
    offset < absoluteLimit
  );

  onEnd();
}

// Read the cursor of a row and verify that we can keep paginating with it
function getCursor(row: object, cursorField: string): Cursor {
  const cursor = (row as Record<string, unknown>)[cursorField];

  if (typeof cursor !== "number" && typeof cursor !== "string") {
    throw new Error(
      `Expected the cursor column "${cursorField}" to hold a number or a string, but got: ${cursor}`,
    );
  }
  return cursor;
}

// Retrieve data in chunks using keyset pagination, i.e. every page continues
// right after the last row of the previous one (WHERE key > lastKey).
//
// This is preferable to the OFFSET-based chunkedQuery() for two reasons:
// 1. Speed: OFFSET forces the database to walk over (and throw away) all rows
//    before the offset, so every page gets slower than the last one and a full
//    export ends up scanning the table once per chunk.
// 2. Correctness: LIMIT / OFFSET without a total order over a unique column
//    gives no guarantee about which rows end up on which page, so rows can be
//    exported twice or skipped entirely in between chunks.
async function keysetQuery({
  queryPage,
  cursorField,
  hideCursorField = false,
  onData,
  onStart = () => {},
  onEnd = () => {},
}: {
  queryPage: PageQuery;
  // Name of the column holding the cursor. It has to be unique and the query
  // has to be ordered by it in ascending order.
  cursorField: string;
  // Whether to remove the cursor column from the data before passing it on
  hideCursorField?: boolean;
  onData: (data: object[]) => Promise<void>;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  const pageSize = config.database.chunkSize;

  let cursor: Cursor | undefined = undefined;
  let nRowsResult: number;
  let isFirstIteration = true;

  do {
    // Retrieve the next page, continuing after the last row we have seen
    const data = await queryPage(cursor, pageSize);
    if (!Array.isArray(data)) {
      throw new Error("Data is always expected to be returned as an Array");
    }
    nRowsResult = data.length;

    if (isFirstIteration) {
      // Call onStart after we received data for the first time to still allow
      // sending error status codes if query code fails.
      onStart();
      isFirstIteration = false;
    }

    if (nRowsResult > pageSize) {
      logger.warn(
        `Query returned more rows (${nRowsResult}) than the page size (${pageSize}). This will lead to a premature exit.`,
      );
    }

    if (nRowsResult > 0) {
      // Remember where to continue before the cursor is (possibly) removed
      const previousCursor = cursor;
      cursor = getCursor(data[nRowsResult - 1], cursorField);

      // Guard against queries which do not actually advance the cursor, as
      // those would otherwise export the same page over and over again.
      if (previousCursor !== undefined && cursor <= previousCursor) {
        throw new Error(
          `The cursor column "${cursorField}" did not advance (${previousCursor} -> ${cursor}). It has to be unique and sorted in ascending order.`,
        );
      }

      if (hideCursorField) {
        for (const row of data) {
          delete (row as Record<string, unknown>)[cursorField];
        }
      }

      // Do something with the data (usually returning it to the user)
      await onData(data);
    }

    // A page that isn't full means that we have reached the end of the data
  } while (nRowsResult === pageSize);

  onEnd();
}

async function generateExtractedPayloadQuery(
  sequelize: Sequelize,
  studyId: string,
  options: { created_after?: Date } = {},
): Promise<{
  // The full query, without any ordering or pagination
  query: string;
  // Query for a single, keyset-paginated page of the full query. Expects a
  // :limit replacement and, if hasCursor is set, a :cursor replacement.
  pageQuery: (hasCursor: boolean) => string;
}> {
  const keysQueryConditions = ['wwl_sessions."studyId" = :studyId'];
  if (options.created_after) {
    // Verify that the created_after option is a Date
    if (!(options.created_after instanceof Date)) {
      throw new AppError("created_after must be a Date object", 400);
    }

    keysQueryConditions.push('wwl_responses."createdAt" >= :created_after');
  }

  // Get all keys which are present in the payloads of the responses
  const keysResult = await sequelize.query(
    `
      SELECT DISTINCT
        payload_json.key as key
      FROM
        wwl_responses
          INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId"),
        json_each(payload) payload_json
      WHERE ${keysQueryConditions.join(" AND ")}
      ORDER BY key ASC;
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        studyId,
        ...(options.created_after && { created_after: options.created_after }),
      },
    },
  );

  // Create a the list of keys in the payload in a safe format
  const jsonKeys = keysResult
    .map((row) => ("key" in row ? row.key : undefined))
    .filter((key) => key !== undefined);
  const jsonFieldsString = jsonKeys
    .map((jsonKey) => `wwl_responses."payload"->>'${jsonKey}' AS "${jsonKey}"`)
    .join(", ");

  // Collect list of table fields, so we can select them without the payload
  const modelAttributes = sequelize.models.Response.getAttributes();
  const tableFields = Object.keys(modelAttributes);
  const fields = tableFields
    .filter((field) => field !== "payload")
    .map((field) => `wwl_responses."${field}"`);
  const tableFieldsString = fields.join(", ");

  // Combine the table and json fields
  const fieldsString =
    jsonKeys.length > 0
      ? `${tableFieldsString}, ${jsonFieldsString}`
      : `${tableFieldsString}`;

  const fromString = `
    FROM wwl_responses
      INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId")
  `;

  const baseConditions = ['wwl_sessions."studyId" = :studyId'];
  if (options.created_after) {
    baseConditions.push('wwl_responses."createdAt" >= :created_after');
  }

  // The full query, used whenever the whole result can be streamed at once
  const query = `
    SELECT
      ${fieldsString}
    ${fromString}
    WHERE ${baseConditions.join(" AND ")}
  `;

  // A single page of the query above, using keyset pagination on the responses'
  // primary key. The cursor is selected under its own, reserved alias, since
  // a payload key could otherwise shadow the "responseId" column.
  const pageQuery = (hasCursor: boolean) => {
    const conditions = [...baseConditions];
    if (hasCursor) {
      conditions.push('wwl_responses."responseId" > :cursor');
    }

    return `
      SELECT
        ${fieldsString},
        wwl_responses."responseId" AS "${KEYSET_CURSOR_COLUMN}"
      ${fromString}
      WHERE ${conditions.join(" AND ")}
      ORDER BY wwl_responses."responseId" ASC
      LIMIT :limit
    `;
  };

  return { query, pageQuery };
}

export {
  KEYSET_CURSOR_COLUMN,
  generateExtractedPayloadQuery,
  keysetExport,
  paginatedExport,
};
export type { Cursor, ExportFormat, PageQuery };
