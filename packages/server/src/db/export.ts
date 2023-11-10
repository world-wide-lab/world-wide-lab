import { Sequelize, QueryTypes } from "sequelize";

async function paginatedExport({
  pageSize,
  queryData,
  onData,
  onStart = () => {},
  onEnd = () => {},
}: {
  pageSize: number;
  queryData: (offset: number, limit: number) => Promise<object[]>;
  onData: (data: object[], offset: number) => Promise<void>;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  let offset = 0;
  let limit = pageSize;

  onStart();

  let n_rows;
  do {
    // Retrieve the data
    let data = await queryData(offset, limit);
    if (!Array.isArray(data)) {
      throw new Error("Data is always expected to be returned as an Array");
    }
    n_rows = data.length;

    // Do something with the data (usually returning it to the user)
    if (n_rows > 0) {
      await onData(data, offset);
    }

    // Increase the offset in case we will continue
    offset += pageSize;

    // Check whether we already got all data
    // e.g. we either got an empty result or our result was less than the limit
  } while (n_rows > 0 && n_rows === limit);

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
