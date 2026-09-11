import { QueryTypes, type Sequelize } from "sequelize";
import { logger } from "../logger.js";

// How far a study's responses have already been scanned.
interface ScanPosition {
  lastResponseId: number | null;
  lastUpdatedAt: Date | null;
}

interface PayloadKeyCache extends ScanPosition {
  keys: string[];
}

// Safety overlap
const SCAN_OVERLAP_MS = 60 * 1000;

const RESPONSES_OF_STUDY = `
  FROM
    wwl_responses
      INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId")
`;

function getScanConditions(studyId: string, position?: ScanPosition) {
  const conditions = ['wwl_sessions."studyId" = :studyId'];
  const replacements: Record<string, unknown> = { studyId };

  if (position) {
    // Responses are new to the cache when they have been added (responseId) or
    // changed (updatedAt) since the last scan.
    const unscanned: string[] = [];
    if (position.lastResponseId !== null) {
      unscanned.push('wwl_responses."responseId" > :lastResponseId');
      replacements.lastResponseId = position.lastResponseId;
    }
    if (position.lastUpdatedAt !== null) {
      unscanned.push('wwl_responses."updatedAt" > :lastUpdatedAt');
      replacements.lastUpdatedAt = new Date(
        position.lastUpdatedAt.getTime() - SCAN_OVERLAP_MS,
      );
    }
    if (unscanned.length > 0) {
      conditions.push(`(${unscanned.join(" OR ")})`);
    }
  }

  return { where: conditions.join(" AND "), replacements };
}

// Dates from raw queries are already a Date (postgres) or a string (sqlite)
function toDate(value: unknown): Date | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Scan a study's responses for the keys used in their payloads
async function queryPayloadKeys(
  sequelize: Sequelize,
  studyId: string,
  position?: ScanPosition,
): Promise<string[]> {
  const { where, replacements } = getScanConditions(studyId, position);

  const rows = await sequelize.query(
    `
      SELECT DISTINCT
        payload_json.key AS key
      ${RESPONSES_OF_STUDY},
        json_each(payload) payload_json
      WHERE ${where};
    `,
    { type: QueryTypes.SELECT, replacements },
  );

  return rows.map((row) => String((row as Record<string, unknown>).key));
}

// Determine how far the responses can be scanned. This has to happen before
// the scan itself, since a response added while it runs would otherwise be
// marked as scanned without having been looked at.
async function queryScanPosition(
  sequelize: Sequelize,
  studyId: string,
  position: ScanPosition | undefined,
): Promise<ScanPosition | undefined> {
  const { where, replacements } = getScanConditions(studyId, position);

  const rows = await sequelize.query(
    `
      SELECT
        MAX(wwl_responses."responseId") AS "lastResponseId",
        MAX(wwl_responses."updatedAt") AS "lastUpdatedAt"
      ${RESPONSES_OF_STUDY}
      WHERE ${where};
    `,
    { type: QueryTypes.SELECT, replacements },
  );

  const row = rows[0] as Record<string, unknown> | undefined;
  if (row === undefined || row.lastResponseId == null) {
    // There are no responses left to scan
    return undefined;
  }

  return {
    lastResponseId: Number(row.lastResponseId),
    lastUpdatedAt: toDate(row.lastUpdatedAt),
  };
}

function getCacheModel(sequelize: Sequelize) {
  return sequelize.models.ResponsePayloadKeyCache;
}

// Read a study's cached keys and how far its responses have been scanned
async function readCache(
  sequelize: Sequelize,
  studyId: string,
): Promise<PayloadKeyCache | undefined> {
  const record = (await getCacheModel(sequelize).findByPk(studyId)) as
    | (PayloadKeyCache & { keys: unknown })
    | null;
  if (record === null) {
    return undefined;
  }

  // An entry we cannot make sense of is rebuilt from scratch.
  if (!Array.isArray(record.keys)) {
    logger.warn(
      `Ignoring the malformed payload key cache of study "${studyId}".`,
    );
    return undefined;
  }

  return {
    keys: record.keys as string[],
    lastResponseId: record.lastResponseId,
    lastUpdatedAt: toDate(record.lastUpdatedAt),
  };
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  return a > b ? a : b;
}

// All keys used in the payloads of a study's responses, bringing the cache up
// to date by scanning the responses that have not been scanned before.
async function getPayloadKeys(
  sequelize: Sequelize,
  studyId: string,
): Promise<string[]> {
  const cache = await readCache(sequelize, studyId);
  // Both parts of the position are needed to tell which responses have already
  // been scanned, so an incomplete one leads to a full re-scan.
  const position =
    cache?.lastResponseId != null && cache?.lastUpdatedAt != null
      ? cache
      : undefined;

  // Check whether anything has been added or changed at all
  const newPosition = await queryScanPosition(sequelize, studyId, position);
  if (newPosition === undefined) {
    return cache?.keys ?? [];
  }

  // Combine cached and new keys, sorted so that exports always use the same
  // order of columns
  const keys = [
    ...new Set([
      ...(cache?.keys ?? []),
      ...(await queryPayloadKeys(sequelize, studyId, position)),
    ]),
  ].sort();

  // Keep the previous position wherever it is further along than this scan's,
  // which happens when responses were changed (updatedAt) without new ones
  // being added (responseId) or the other way around.
  await getCacheModel(sequelize).upsert({
    studyId,
    keys,
    lastResponseId: Math.max(
      newPosition.lastResponseId ?? 0,
      position?.lastResponseId ?? 0,
    ),
    lastUpdatedAt: maxDate(
      newPosition.lastUpdatedAt,
      position?.lastUpdatedAt ?? null,
    ),
  });

  return keys;
}

// Drop the cached keys of a study
async function clearPayloadKeyCache(sequelize: Sequelize, studyId: string) {
  await getCacheModel(sequelize).destroy({
    where: { studyId },
  });
}

// Drop the cached keys of all studies
async function clearFullPayloadKeyCache(sequelize: Sequelize) {
  await getCacheModel(sequelize).destroy({ where: {} });
}

export { getPayloadKeys, clearPayloadKeyCache, clearFullPayloadKeyCache };
