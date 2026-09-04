import { QueryTypes, type Sequelize } from "sequelize";
import {
  type SupportedDialect,
  getDialect,
  sqlCountIf,
  sqlDateString,
  sqlJsonValue,
  sqlSecondsBetween,
  sqlUrlWithoutQuery,
  toNumber,
} from "./sql.js";

// Default number of days shown in the statistics over time
const DEFAULT_TIMEFRAME = 30;
// Highest number of days that can be requested at once
const MAX_TIMEFRAME = 365;
// Number of points kept in the dropout curve
const MAX_RETENTION_POINTS = 50;
// Number of distinct values retrieved for the recruitment analyses. Anything
// beyond this is not counted, which is indicated via truncated: true.
const MAX_DISTINCT_VALUES = 1000;
// Number of values shown per recruitment breakdown, the rest is grouped
// together into a single entry.
const N_TOP_VALUES = 10;

const LABEL_OTHER = "(other)";
const LABEL_UNKNOWN = "(unknown)";
const LABEL_NO_REFERRER = "(none / direct)";

type StatsOptions = {
  // Restrict the statistics to a single study
  studyId?: string;
  // Number of days to include in the statistics over time
  days?: number;
};

type SessionsOverTimeEntry = {
  date: string;
  nSessions: number;
  nFinished: number;
  // Share of finished sessions, null when there are no sessions that day
  completionRate: number | null;
};

type StudyStatsEntry = {
  studyId: string;
  nSessions: number;
  nFinished: number;
  completionRate: number | null;
  // Sessions with at least one response, only those can be timed
  nTimedSessions: number;
  meanDurationSeconds: number | null;
};

type ResponsesPerSessionStats = {
  nSessions: number;
  nResponses: number;
  meanResponsesPerSession: number | null;
  // How many sessions have exactly n responses
  histogram: Array<{ nResponses: number; nSessions: number }>;
  // How many sessions have at least n responses i.e. how many participants
  // are still around after n responses
  retention: Array<{ nResponses: number; nSessions: number; share: number }>;
  retentionTruncated: boolean;
};

type ParticipantLinkingStats = {
  // Participants with at least one session
  nParticipants: number;
  nParticipantsWithMultipleSessions: number;
  // Participants with more than one session in the same study
  nParticipantsRepeatingAStudy: number;
  nParticipantsWithMultipleStudies: number;
  sessionsPerParticipant: Array<{
    nSessions: number;
    nParticipants: number;
  }>;
  studiesPerParticipant: Array<{ nStudies: number; nParticipants: number }>;
  // How often participants moved from one study to another one
  studyTransitions: Array<{
    fromStudyId: string;
    toStudyId: string;
    nTransitions: number;
  }>;
};

type ValueCountEntry = {
  value: string;
  nSessions: number;
  share: number;
};

type RecruitmentBreakdown = {
  entries: Array<ValueCountEntry>;
  truncated: boolean;
};

type RecruitmentStats = {
  bySourceUrl: RecruitmentBreakdown;
  byReferrer: RecruitmentBreakdown;
  bySourceParameter: RecruitmentBreakdown;
};

type Stats = {
  options: { studyId: string | null; days: number };
  studyIds: Array<string>;
  sessionsOverTime: Array<SessionsOverTimeEntry>;
  studies: Array<StudyStatsEntry>;
  responsesPerSession: ResponsesPerSessionStats;
  participantLinking: ParticipantLinkingStats;
  recruitment: RecruitmentStats;
};

// Restrict a query to the sessions of the selected study and timeframe
function sessionFilter(
  options: StatsOptions,
  columns: { createdAt: string; studyId: string } = {
    createdAt: '"createdAt"',
    studyId: '"studyId"',
  },
): { sql: string; replacements: Record<string, unknown> } {
  const { firstDate } = getDates(options.days ?? DEFAULT_TIMEFRAME);

  const conditions = [`${columns.createdAt} >= :firstDate`];
  const replacements: Record<string, unknown> = { firstDate };
  if (options.studyId) {
    conditions.push(`${columns.studyId} = :studyId`);
    replacements.studyId = options.studyId;
  }

  return { sql: `WHERE ${conditions.join(" AND ")}`, replacements };
}

// List of days (as YYYY-MM-DD in UTC) covered by the given timeframe
function getDates(days: number): { firstDate: Date; dates: Array<string> } {
  const firstDate = new Date();
  firstDate.setUTCHours(0, 0, 0, 0);
  firstDate.setUTCDate(firstDate.getUTCDate() - (days - 1));

  const dates: Array<string> = [];
  const now = new Date();
  const currentDate = new Date(firstDate);
  while (currentDate <= now) {
    dates.push(currentDate.toISOString().slice(0, 10));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return { firstDate, dates };
}

function share(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

// Number of sessions (and how many of them have been finished) per day
async function getSessionsOverTime(
  sequelize: Sequelize,
  options: StatsOptions = {},
): Promise<Array<SessionsOverTimeEntry>> {
  const dialect = getDialect(sequelize);
  const { dates } = getDates(options.days ?? DEFAULT_TIMEFRAME);
  const filter = sessionFilter(options);
  const dateColumn = sqlDateString(dialect, '"createdAt"');

  const rows = await sequelize.query<{
    date: string;
    nSessions: number | string;
    nFinished: number | string | null;
  }>(
    `
      SELECT
        ${dateColumn} AS "date",
        COUNT(*) AS "nSessions",
        ${sqlCountIf('"finished"')} AS "nFinished"
      FROM "wwl_sessions"
      ${filter.sql}
      GROUP BY ${dateColumn}
    `,
    { replacements: filter.replacements, type: QueryTypes.SELECT },
  );

  // Days without any sessions are missing from the query above, so the
  // results are mapped onto the full list of days here.
  const rowsByDate = new Map(rows.map((row) => [row.date, row]));
  return dates.map((date) => {
    const row = rowsByDate.get(date);
    const nSessions = toNumber(row?.nSessions);
    const nFinished = toNumber(row?.nFinished);
    return {
      date,
      nSessions,
      nFinished,
      completionRate: share(nFinished, nSessions),
    };
  });
}

// Sessions, completion and duration of every study. A session's duration is
// measured from its start until its last response, so sessions without any
// responses can not be timed.
async function getStudyStats(
  sequelize: Sequelize,
): Promise<Array<StudyStatsEntry>> {
  const duration = sqlSecondsBetween(
    getDialect(sequelize),
    'MAX("wwl_responses"."createdAt")',
    '"wwl_sessions"."createdAt"',
  );

  const rows = await sequelize.query<{
    studyId: string;
    nSessions: number | string;
    nFinished: number | string | null;
    nTimedSessions: number | string;
    meanDurationSeconds: number | string | null;
  }>(
    `
      SELECT
        "wwl_studies"."studyId" AS "studyId",
        COUNT("sessions"."sessionId") AS "nSessions",
        ${sqlCountIf('"sessions"."finished"')} AS "nFinished",
        COUNT("sessions"."durationSeconds") AS "nTimedSessions",
        AVG("sessions"."durationSeconds") AS "meanDurationSeconds"
      FROM "wwl_studies"
      LEFT JOIN (
        SELECT
          "wwl_sessions"."sessionId" AS "sessionId",
          "wwl_sessions"."studyId" AS "studyId",
          "wwl_sessions"."finished" AS "finished",
          ${duration} AS "durationSeconds"
        FROM "wwl_sessions"
        LEFT JOIN "wwl_responses"
          ON "wwl_responses"."sessionId" = "wwl_sessions"."sessionId"
        GROUP BY
          "wwl_sessions"."sessionId",
          "wwl_sessions"."studyId",
          "wwl_sessions"."finished",
          "wwl_sessions"."createdAt"
      ) AS "sessions" ON "sessions"."studyId" = "wwl_studies"."studyId"
      GROUP BY "wwl_studies"."studyId"
      ORDER BY COUNT("sessions"."sessionId") DESC, "wwl_studies"."studyId"
    `,
    { type: QueryTypes.SELECT },
  );

  return rows.map((row) => {
    const nSessions = toNumber(row.nSessions);
    const nFinished = toNumber(row.nFinished);
    return {
      studyId: row.studyId,
      nSessions,
      nFinished,
      completionRate: share(nFinished, nSessions),
      nTimedSessions: toNumber(row.nTimedSessions),
      meanDurationSeconds:
        row.meanDurationSeconds === null
          ? null
          : toNumber(row.meanDurationSeconds),
    };
  });
}

// How many responses sessions have, which indicates where participants
// dropped out of a study
async function getResponsesPerSession(
  sequelize: Sequelize,
  options: StatsOptions = {},
): Promise<ResponsesPerSessionStats> {
  const filter = sessionFilter(options, {
    createdAt: '"wwl_sessions"."createdAt"',
    studyId: '"wwl_sessions"."studyId"',
  });

  const rows = await sequelize.query<{
    nResponses: number | string;
    nSessions: number | string;
  }>(
    `
      SELECT "nResponses", COUNT(*) AS "nSessions"
      FROM (
        SELECT
          "wwl_sessions"."sessionId" AS "sessionId",
          COUNT("wwl_responses"."responseId") AS "nResponses"
        FROM "wwl_sessions"
        LEFT JOIN "wwl_responses"
          ON "wwl_responses"."sessionId" = "wwl_sessions"."sessionId"
        ${filter.sql}
        GROUP BY "wwl_sessions"."sessionId"
      ) AS "sessions"
      GROUP BY "nResponses"
      ORDER BY "nResponses"
    `,
    { replacements: filter.replacements, type: QueryTypes.SELECT },
  );

  const histogram = rows.map((row) => ({
    nResponses: toNumber(row.nResponses),
    nSessions: toNumber(row.nSessions),
  }));

  const nSessions = histogram.reduce((sum, row) => sum + row.nSessions, 0);
  const nResponses = histogram.reduce(
    (sum, row) => sum + row.nResponses * row.nSessions,
    0,
  );

  // How many sessions are still around after n responses
  const maxResponses = histogram.length
    ? histogram[histogram.length - 1].nResponses
    : 0;
  const retentionLength = Math.min(maxResponses, MAX_RETENTION_POINTS);
  const retention = [];
  let remaining = nSessions;
  for (let n = 1; n <= retentionLength; n++) {
    // Sessions with exactly n - 1 responses do not make it any further
    const droppedOut = histogram.find((row) => row.nResponses === n - 1);
    remaining -= droppedOut ? droppedOut.nSessions : 0;
    retention.push({
      nResponses: n,
      nSessions: remaining,
      share: share(remaining, nSessions) ?? 0,
    });
  }

  return {
    nSessions,
    nResponses,
    meanResponsesPerSession: share(nResponses, nSessions),
    histogram,
    retention,
    retentionTruncated: maxResponses > retentionLength,
  };
}

// How many participants there are per number of sessions, studies, ... The
// aggregate is computed per participant, e.g. COUNT(*) for their sessions.
async function countParticipantsPer(
  sequelize: Sequelize,
  aggregate: string,
): Promise<Array<{ value: number; nParticipants: number }>> {
  const rows = await sequelize.query<{
    value: number | string;
    nParticipants: number | string;
  }>(
    `
      SELECT "value", COUNT(*) AS "nParticipants"
      FROM (
        SELECT "participantId", ${aggregate} AS "value"
        FROM "wwl_sessions"
        WHERE "participantId" IS NOT NULL
        GROUP BY "participantId"
      ) AS "participants"
      GROUP BY "value"
      ORDER BY "value"
    `,
    { type: QueryTypes.SELECT },
  );

  return rows.map((row) => ({
    value: toNumber(row.value),
    nParticipants: toNumber(row.nParticipants),
  }));
}

// How participants are linked across sessions and studies
async function getParticipantLinking(
  sequelize: Sequelize,
): Promise<ParticipantLinkingStats> {
  const [sessionCounts, studyCounts, repeatedStudyRows, transitionRows] =
    await Promise.all([
      countParticipantsPer(sequelize, "COUNT(*)"),
      countParticipantsPer(sequelize, 'COUNT(DISTINCT "studyId")'),
      // Participants who have taken part in the same study more than once
      sequelize.query<{ nParticipants: number | string }>(
        `
          SELECT COUNT(DISTINCT "participantId") AS "nParticipants"
          FROM (
            SELECT "participantId"
            FROM "wwl_sessions"
            WHERE "participantId" IS NOT NULL
            GROUP BY "participantId", "studyId"
            HAVING COUNT(*) > 1
          ) AS "repeated"
        `,
        { type: QueryTypes.SELECT },
      ),
      // Sessions which are in a different study than a participant's
      // previous one
      sequelize.query<{
        fromStudyId: string;
        toStudyId: string;
        nTransitions: number | string;
      }>(
        `
          SELECT
            "previousStudyId" AS "fromStudyId",
            "studyId" AS "toStudyId",
            COUNT(*) AS "nTransitions"
          FROM (
            SELECT
              "studyId",
              LAG("studyId") OVER (
                PARTITION BY "participantId" ORDER BY "createdAt"
              ) AS "previousStudyId"
            FROM "wwl_sessions"
            WHERE "participantId" IS NOT NULL
          ) AS "transitions"
          WHERE "previousStudyId" IS NOT NULL
            AND "previousStudyId" <> "studyId"
          GROUP BY "previousStudyId", "studyId"
          ORDER BY COUNT(*) DESC, "previousStudyId", "studyId"
        `,
        { type: QueryTypes.SELECT },
      ),
    ]);

  const countParticipants = (
    entries: Array<{ value: number; nParticipants: number }>,
    where: (value: number) => boolean = () => true,
  ): number =>
    entries
      .filter((entry) => where(entry.value))
      .reduce((sum, entry) => sum + entry.nParticipants, 0);

  return {
    nParticipants: countParticipants(sessionCounts),
    nParticipantsWithMultipleSessions: countParticipants(
      sessionCounts,
      (value) => value > 1,
    ),
    nParticipantsRepeatingAStudy: toNumber(repeatedStudyRows[0]?.nParticipants),
    nParticipantsWithMultipleStudies: countParticipants(
      studyCounts,
      (value) => value > 1,
    ),
    sessionsPerParticipant: sessionCounts.map((entry) => ({
      nSessions: entry.value,
      nParticipants: entry.nParticipants,
    })),
    studiesPerParticipant: studyCounts.map((entry) => ({
      nStudies: entry.value,
      nParticipants: entry.nParticipants,
    })),
    studyTransitions: transitionRows.map((row) => ({
      fromStudyId: row.fromStudyId,
      toStudyId: row.toStudyId,
      nTransitions: toNumber(row.nTransitions),
    })),
  };
}

// Count how often each value occurs in a session's metadata
async function countMetadataValues(
  sequelize: Sequelize,
  expression: string,
  options: StatsOptions,
): Promise<Array<{ value: string | null; nSessions: number }>> {
  const filter = sessionFilter(options);

  const rows = await sequelize.query<{
    value: string | null;
    nSessions: number | string;
  }>(
    `
      SELECT "value", COUNT(*) AS "nSessions"
      FROM (
        SELECT ${expression} AS "value"
        FROM "wwl_sessions"
        ${filter.sql}
      ) AS "values"
      GROUP BY "value"
      ORDER BY COUNT(*) DESC
      LIMIT ${MAX_DISTINCT_VALUES}
    `,
    { replacements: filter.replacements, type: QueryTypes.SELECT },
  );

  return rows.map((row) => ({
    value: row.value,
    nSessions: toNumber(row.nSessions),
  }));
}

// Group the counted values, keeping only the most common ones and summing up
// everything else into a single entry
function summarizeValues(
  rows: Array<{ value: string | null; nSessions: number }>,
  options: {
    normalize?: (value: string) => string;
    unknownLabel?: string;
  } = {},
): RecruitmentBreakdown {
  const { normalize, unknownLabel = LABEL_UNKNOWN } = options;

  const counts = new Map<string, number>();
  for (const row of rows) {
    const value =
      row.value === null || row.value === ""
        ? unknownLabel
        : normalize?.(row.value) ?? row.value;
    counts.set(value, (counts.get(value) ?? 0) + row.nSessions);
  }

  // Most common values first, ties are broken by name to keep the order of
  // the entries stable
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const total = sorted.reduce((sum, [, nSessions]) => sum + nSessions, 0);

  const entries: Array<ValueCountEntry> = sorted
    .slice(0, N_TOP_VALUES)
    .map(([value, nSessions]) => ({
      value,
      nSessions,
      share: share(nSessions, total) ?? 0,
    }));
  const nOther = sorted
    .slice(N_TOP_VALUES)
    .reduce((sum, [, nSessions]) => sum + nSessions, 0);
  if (nOther > 0) {
    entries.push({
      value: LABEL_OTHER,
      nSessions: nOther,
      share: share(nOther, total) ?? 0,
    });
  }

  return { entries, truncated: rows.length >= MAX_DISTINCT_VALUES };
}

// Reduce a referrer to the website it points to, since the exact page
// participants came from is rarely of interest
function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

// Where sessions are coming from, based on the metadata collected when a
// session is started
async function getRecruitment(
  sequelize: Sequelize,
  options: StatsOptions = {},
): Promise<RecruitmentStats> {
  const dialect: SupportedDialect = getDialect(sequelize);
  const jsonValue = (path: Array<string>) =>
    sqlJsonValue(dialect, '"metadata"', path);

  // Common names for the parameter used to mark where participants have been
  // recruited from e.g. study.org/?source=newsletter
  const sourceParameter = `COALESCE(
    ${jsonValue(["client", "searchParams", "source"])},
    ${jsonValue(["client", "searchParams", "utm_source"])},
    ${jsonValue(["client", "searchParams", "ref"])}
  )`;

  const [sourceUrls, referrers, sourceParameters] = await Promise.all([
    countMetadataValues(
      sequelize,
      sqlUrlWithoutQuery(dialect, jsonValue(["client", "url"])),
      options,
    ),
    countMetadataValues(sequelize, jsonValue(["referer"]), options),
    countMetadataValues(sequelize, sourceParameter, options),
  ]);

  return {
    bySourceUrl: summarizeValues(sourceUrls),
    byReferrer: summarizeValues(referrers, {
      normalize: getOrigin,
      unknownLabel: LABEL_NO_REFERRER,
    }),
    bySourceParameter: summarizeValues(sourceParameters, {
      unknownLabel: LABEL_UNKNOWN,
    }),
  };
}

// Make sure only a sensible number of days can be requested
function sanitizeTimeframe(days: unknown): number {
  const parsed = Math.floor(toNumber(days, DEFAULT_TIMEFRAME));
  if (!parsed || parsed < 1) {
    return DEFAULT_TIMEFRAME;
  }
  return Math.min(parsed, MAX_TIMEFRAME);
}

// Compute all statistics at once
async function getStats(
  sequelize: Sequelize,
  options: StatsOptions = {},
): Promise<Stats> {
  const days = sanitizeTimeframe(options.days);
  const statsOptions = { ...options, days };

  const [
    sessionsOverTime,
    studies,
    responsesPerSession,
    participantLinking,
    recruitment,
  ] = await Promise.all([
    getSessionsOverTime(sequelize, statsOptions),
    getStudyStats(sequelize),
    getResponsesPerSession(sequelize, statsOptions),
    getParticipantLinking(sequelize),
    getRecruitment(sequelize, statsOptions),
  ]);

  return {
    options: { studyId: options.studyId ?? null, days },
    studyIds: studies.map((entry) => entry.studyId),
    sessionsOverTime,
    studies,
    responsesPerSession,
    participantLinking,
    recruitment,
  };
}

export {
  type StatsOptions,
  type Stats,
  type ParticipantLinkingStats,
  type RecruitmentStats,
  type RecruitmentBreakdown,
  type ResponsesPerSessionStats,
  type SessionsOverTimeEntry,
  type StudyStatsEntry,
  type ValueCountEntry,
  getStats,
  getStudyStats,
  getParticipantLinking,
  getRecruitment,
  getResponsesPerSession,
  getSessionsOverTime,
  sanitizeTimeframe,
};
