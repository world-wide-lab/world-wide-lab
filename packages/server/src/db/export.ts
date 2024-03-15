import type { Response } from "express";
import { json2csv } from "json-2-csv";
import { QueryTypes, Sequelize } from "sequelize";
import config from "../config";

// Export data from the database in chunks
async function paginatedExport(
  res: Response,
  queryData: (offset: number, limit: number) => Promise<object[]>,
  format: "json" | "csv",
  limit: number = Infinity,
  initialOffset = 0,
) {
  const onStart = () => {
    if (format === "json") {
      res.status(200).contentType("application/json");

      res.write("[");
    } else if (format === "csv") {
      res.status(200).contentType("text/csv");
    }
  };

  // Process & return each chunk of data
  const onData = async (data: object[], offset: number) => {
    const isFirstChunk = offset === initialOffset;

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
    } else {
      throw new Error(`Unknown format: ${format}`);
    }
  };
  // Complete the data export
  const onEnd = () => {
    if (format === "json") {
      res.write("]");
    }

    // Mark the response as finished
    res.end();
  };

  return await chunkedQuery({
    queryData,
    onData,
    onStart,
    onEnd,
    limit,
    initialOffset,
  });
}

async function chunkedQuery({
  queryData,
  onData,
  onStart = () => {},
  onEnd = () => {},
  limit = Infinity,
  initialOffset = 0,
}: {
  queryData: (offset: number, limit: number) => Promise<object[]>;
  onData: (data: object[], offset: number) => Promise<void>;
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

    // Do something with the data (usually returning it to the user)
    if (nRowsResult > 0) {
      await onData(data, offset);
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

async function generateExtractedPayloadQuery(
  sequelize: Sequelize,
  studyId: string,
): Promise<string> {
  // Get all keys which are present in the payloads of the responses
  const keysResult = await sequelize.query(
    `
      SELECT DISTINCT
        payload_json.key as key
      FROM
        wwl_responses
          INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId"),
        json_each(payload) payload_json
      WHERE wwl_sessions."studyId" = :studyId
      ORDER BY key ASC;
    `,
    {
      type: QueryTypes.SELECT,
      replacements: { studyId },
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

  // Create the final query
  return `
    SELECT
      ${fieldsString}
    FROM wwl_responses
      INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId")
    WHERE wwl_sessions."studyId" = :studyId
  `;
}

export { paginatedExport, generateExtractedPayloadQuery };
