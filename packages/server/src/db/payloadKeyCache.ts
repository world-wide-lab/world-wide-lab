import { QueryTypes, type Sequelize } from "sequelize";
import config from "../config.js";
import { logger } from "../logger.js";

// A key that has been found in the payload of a study's responses, together
// with the creation date of the most recent response it appeared in. Keeping
// that date around allows the cache to also answer which keys are present in
// only a part of the responses (created_after), instead of being limited to
// full exports.
interface CachedPayloadKey {
  key: string;
  // Date of the most recent response containing the key, as an ISO string.
  // It is null whenever that date could not be determined, in which case the
  // key is always included, so that no data can go missing from an export.
  lastSeenAt: string | null;
}

// How far the responses of a study have already been scanned for payload keys.
// Every scan continues from here, so that responses only ever have to be
// looked at once, which is what makes repeated exports fast.
interface ScanPosition {
  // The highest responseId that has been scanned so far
  lastResponseId: number | null;
  // The most recent updatedAt that has been scanned so far. Responses that
  // have been changed after this have to be scanned again, since their
  // payload (and with it their keys) may have changed as well.
  lastUpdatedAt: Date | null;
}

interface PayloadKeyCache extends ScanPosition {
  keys: CachedPayloadKey[];
}

// How far back every scan reaches beyond the position of the previous one.
// A response only becomes visible to a scan once it has been committed, which
// can happen after a response that has been created later already is. Without
// an overlap, such a response would fall behind the position of the scan that
// missed it and its keys would never make it into the cache. Re-scanning the
// last few moments before the previous position closes that gap, at the cost
// of looking at a handful of responses twice.
const SCAN_OVERLAP_MS = 60 * 1000;

// The responses of a study, which are scanned for payload keys
const RESPONSES_OF_STUDY = `
  FROM
    wwl_responses
      INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId")
`;

// Conditions (and their replacements) limiting a scan to the responses of a
// single study and, if a position is given, to the ones that have not been
// scanned for keys yet.
function getScanConditions(
  studyId: string,
  options: { created_after?: Date; position?: ScanPosition },
) {
  const conditions = ['wwl_sessions."studyId" = :studyId'];
  const replacements: Record<string, unknown> = { studyId };

  if (options.created_after) {
    conditions.push('wwl_responses."createdAt" >= :created_after');
    replacements.created_after = options.created_after;
  }

  if (options.position) {
    const { lastResponseId, lastUpdatedAt } = options.position;
    // Responses are new to the cache when they have either been added
    // (responseId) or changed (updatedAt) after the last scan.
    const unscanned: string[] = [];
    if (lastResponseId !== null) {
      unscanned.push('wwl_responses."responseId" > :lastResponseId');
      replacements.lastResponseId = lastResponseId;
    }
    if (lastUpdatedAt !== null) {
      unscanned.push('wwl_responses."updatedAt" > :lastUpdatedAt');
      replacements.lastUpdatedAt = new Date(
        lastUpdatedAt.getTime() - SCAN_OVERLAP_MS,
      );
    }
    if (unscanned.length > 0) {
      conditions.push(`(${unscanned.join(" OR ")})`);
    }
  }

  return { where: conditions.join(" AND "), replacements };
}

// Parse a date as it is returned from a raw query. Depending on the dialect,
// this is either a Date already (postgres) or a string (sqlite).
function parseDate(value: unknown, description: string): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    logger.warn(`Could not parse ${description} as a date: ${value}`);
    return null;
  }
  return date;
}

// Retrieve all keys used in the payloads of a study's responses
async function queryPayloadKeys(
  sequelize: Sequelize,
  studyId: string,
  options: { created_after?: Date; position?: ScanPosition } = {},
): Promise<CachedPayloadKey[]> {
  const { where, replacements } = getScanConditions(studyId, options);

  const rows = await sequelize.query(
    `
      SELECT
        payload_json.key AS key,
        MAX(wwl_responses."createdAt") AS "lastSeenAt"
      ${RESPONSES_OF_STUDY},
        json_each(payload) payload_json
      WHERE ${where}
      GROUP BY payload_json.key
      ORDER BY key ASC;
    `,
    { type: QueryTypes.SELECT, replacements },
  );

  return rows.map((row) => {
    const { key, lastSeenAt } = row as Record<string, unknown>;
    return {
      key: String(key),
      lastSeenAt:
        parseDate(lastSeenAt, `the date of the key "${key}"`)?.toISOString() ??
        null,
    };
  });
}

// Determine up to which point the responses of a study can be scanned. This
// has to happen before the actual scan, since any response that is added while
// scanning would otherwise be marked as scanned without having been looked at.
async function queryScanPosition(
  sequelize: Sequelize,
  studyId: string,
  position: ScanPosition | undefined,
): Promise<ScanPosition | undefined> {
  const { where, replacements } = getScanConditions(studyId, { position });

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
    lastUpdatedAt: parseDate(
      row.lastUpdatedAt,
      `the last updatedAt of study "${studyId}"`,
    ),
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

  // Guard against a cache entry that we cannot make sense of, e.g. because it
  // has been written by a different version. Such an entry is simply rebuilt.
  if (!Array.isArray(record.keys)) {
    logger.warn(
      `Ignoring the malformed payload key cache of study "${studyId}".`,
    );
    return undefined;
  }

  return {
    keys: record.keys as CachedPayloadKey[],
    lastResponseId: record.lastResponseId,
    lastUpdatedAt: parseDate(
      record.lastUpdatedAt,
      `the cached last updatedAt of study "${studyId}"`,
    ),
  };
}

function maxDate(a: Date | null, b: Date | null = null): Date | null {
  if (a === null || b === null) {
    return a ?? b;
  }
  return a > b ? a : b;
}

// Add newly found keys to the ones that are already cached, keeping the most
// recent date for every key.
function mergeKeys(
  cached: CachedPayloadKey[],
  found: CachedPayloadKey[],
): CachedPayloadKey[] {
  // A Map is used here (instead of a plain object), since payload keys are
  // provided by users and could otherwise clash with an object's properties.
  const merged = new Map<string, string | null>();
  for (const { key, lastSeenAt } of [...cached, ...found]) {
    if (!merged.has(key)) {
      merged.set(key, lastSeenAt ?? null);
      continue;
    }
    const previous = merged.get(key);
    // A missing date means that the key is always included, so it wins over
    // any actual date.
    if (previous == null || lastSeenAt == null) {
      merged.set(key, null);
    } else {
      merged.set(key, lastSeenAt > previous ? lastSeenAt : previous);
    }
  }

  return [...merged.entries()].map(([key, lastSeenAt]) => ({
    key,
    lastSeenAt,
  }));
}

// Bring the cached keys of a study up to date, by scanning all of its
// responses that have not been scanned before.
async function updateCache(
  sequelize: Sequelize,
  studyId: string,
): Promise<CachedPayloadKey[]> {
  const cache = await readCache(sequelize, studyId);
  // Both parts of the position are needed to reliably tell which responses
  // have already been scanned, so an incomplete one leads to a full re-scan.
  const position =
    cache?.lastResponseId != null && cache?.lastUpdatedAt != null
      ? cache
      : undefined;

  // Check whether there is anything that has been added or changed since the
  // last scan, before doing the (much more expensive) scan itself.
  const newPosition = await queryScanPosition(sequelize, studyId, position);
  if (newPosition === undefined) {
    // Nothing new to scan, the cache is already up to date
    return cache?.keys ?? [];
  }

  const foundKeys = await queryPayloadKeys(sequelize, studyId, { position });
  const keys = mergeKeys(cache?.keys ?? [], foundKeys);

  // Keep the position of the previous scan whenever it is further along than
  // the one of this scan, which happens when responses have been changed
  // (updatedAt) without new ones having been added (responseId) or the other
  // way around.
  await getCacheModel(sequelize).upsert({
    studyId,
    keys,
    lastResponseId: Math.max(
      newPosition.lastResponseId ?? 0,
      position?.lastResponseId ?? 0,
    ),
    lastUpdatedAt: maxDate(newPosition.lastUpdatedAt, position?.lastUpdatedAt),
  });

  return keys;
}

// Reduce the cached keys to the ones that are actually part of an export
function selectKeys(keys: CachedPayloadKey[], created_after?: Date): string[] {
  // A key is part of the export whenever it appears in at least one of the
  // exported responses, i.e. when the most recent response containing it has
  // been created after the cut-off date.
  const selected = keys.filter(
    ({ lastSeenAt }) =>
      created_after === undefined ||
      lastSeenAt == null ||
      new Date(lastSeenAt) >= created_after,
  );

  // Sort the keys, so that exports always use the same order of columns
  return selected.map(({ key }) => key).sort();
}

// Retrieve all keys used in the payloads of a study's responses, using (and
// updating) the cache in the database. Scanning the payloads of all responses
// is by far the most expensive part of an extracted-payload export, so caching
// the result makes any repeated export of a study much faster.
async function getPayloadKeys(
  sequelize: Sequelize,
  studyId: string,
  options: { created_after?: Date } = {},
): Promise<string[]> {
  if (config.database.cachePayloadKeys) {
    try {
      const keys = await updateCache(sequelize, studyId);
      return selectKeys(keys, options.created_after);
    } catch (error) {
      // Exports should still work when the cache does not, e.g. when its
      // migration has not been applied (yet).
      logger.warn(
        `Failed to use the payload key cache of study "${studyId}", falling back to scanning all of its responses.`,
        error,
      );
    }
  }

  // Without the cache, the keys have to be scanned from all responses again
  const keys = await queryPayloadKeys(sequelize, studyId, {
    created_after: options.created_after,
  });
  return selectKeys(keys);
}

// Drop the cached keys of a study (or of all studies), so that they will be
// determined from scratch again. This is only necessary when responses have
// been deleted, since keys are otherwise kept up to date automatically.
async function clearPayloadKeyCache(sequelize: Sequelize, studyId?: string) {
  await getCacheModel(sequelize).destroy({
    where: studyId === undefined ? {} : { studyId },
  });
}

export { getPayloadKeys, clearPayloadKeyCache };
export type { CachedPayloadKey };
