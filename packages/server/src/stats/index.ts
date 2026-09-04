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
  nFinishedSessions: number;
  nResponses: number;
  meanResponsesPerSession: number | null;
  // How many sessions have exactly n responses, split by whether they have
  // been marked as finished
  histogram: Array<{
    nResponses: number;
    nFinished: number;
    nUnfinished: number;
  }>;
  // Share of sessions with at least n responses. Finished and unfinished
  // sessions are counted separately, each within their own group, since the
  // length of finished sessions can vary just as much as the point at which
  // participants drop out.
  retention: Array<{
    nResponses: number;
    finished: number | null;
    unfinished: number | null;
  }>;
  retentionTruncated: boolean;
};

type ParticipantStats = {
  // Participants with at least one session in the current scope
  nParticipants: number;
  nParticipantsWithMultipleSessions: number;
  // Participants with more than one session in the same study
  nParticipantsRepeatingAStudy: number;
  // Participants who take part in more than one study. When a single study is
  // selected, these are the ones who have also taken part in another study.
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
  // Every study, for the study picker
  studyIds: Array<string>;
  sessionsOverTime: Array<SessionsOverTimeEntry>;
  participants: ParticipantStats;
  recruitment: RecruitmentStats;
  // A comparison of all studies, only part of the overview
  studies?: Array<StudyStatsEntry>;
  // The selected study and how far participants get in it, only part of the
  // stats of a single study
  study?: StudyStatsEntry;
  responsesPerSession?: ResponsesPerSessionStats;
};

type SqlFilter = { sql: string; replacements: Record<string, unknown> };

// Restrict a query to the sessions of the selected study and timeframe
function sessionFilter(
  options: StatsOptions,
  columns: { createdAt: string; studyId: string } = {
    createdAt: '"createdAt"',
    studyId: '"studyId"',
  },
): SqlFilter {
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
  options: StatsOptions = {},
): Promise<Array<StudyStatsEntry>> {
  const duration = sqlSecondsBetween(
    getDialect(sequelize),
    'MAX("wwl_responses"."createdAt")',
    '"wwl_sessions"."createdAt"',
  );
  // Sessions are limited to the timeframe, the studies themselves are not
  const filter = sessionFilter(
    { days: options.days },
    {
      createdAt: '"wwl_sessions"."createdAt"',
      studyId: '"wwl_sessions"."studyId"',
    },
  );
  const onlyStudy = options.studyId
    ? 'WHERE "wwl_studies"."studyId" = :studyId'
    : "";

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
        ${filter.sql}
        GROUP BY
          "wwl_sessions"."sessionId",
          "wwl_sessions"."studyId",
          "wwl_sessions"."finished",
          "wwl_sessions"."createdAt"
      ) AS "sessions" ON "sessions"."studyId" = "wwl_studies"."studyId"
      ${onlyStudy}
      GROUP BY "wwl_studies"."studyId"
      ORDER BY COUNT("sessions"."sessionId") DESC, "wwl_studies"."studyId"
    `,
    {
      replacements: {
        ...filter.replacements,
        ...(options.studyId ? { studyId: options.studyId } : {}),
      },
      type: QueryTypes.SELECT,
    },
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

// How many responses the sessions of a study have, which shows how far
// participants get before they leave
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
    finished: boolean | number;
    nSessions: number | string;
  }>(
    `
      SELECT "nResponses", "finished", COUNT(*) AS "nSessions"
      FROM (
        SELECT
          "wwl_sessions"."sessionId" AS "sessionId",
          "wwl_sessions"."finished" AS "finished",
          COUNT("wwl_responses"."responseId") AS "nResponses"
        FROM "wwl_sessions"
        LEFT JOIN "wwl_responses"
          ON "wwl_responses"."sessionId" = "wwl_sessions"."sessionId"
        ${filter.sql}
        GROUP BY "wwl_sessions"."sessionId", "wwl_sessions"."finished"
      ) AS "sessions"
      GROUP BY "nResponses", "finished"
      ORDER BY "nResponses"
    `,
    { replacements: filter.replacements, type: QueryTypes.SELECT },
  );

  const counts = new Map<number, { nFinished: number; nUnfinished: number }>();
  for (const row of rows) {
    const nResponses = toNumber(row.nResponses);
    const entry = counts.get(nResponses) ?? { nFinished: 0, nUnfinished: 0 };
    // Booleans are returned as 0 and 1 by some of the supported databases
    if (row.finished === true || row.finished === 1) {
      entry.nFinished += toNumber(row.nSessions);
    } else {
      entry.nUnfinished += toNumber(row.nSessions);
    }
    counts.set(nResponses, entry);
  }

  const histogram = [...counts.entries()]
    .map(([nResponses, entry]) => ({ nResponses, ...entry }))
    .sort((a, b) => a.nResponses - b.nResponses);

  const total = (key: "nFinished" | "nUnfinished"): number =>
    histogram.reduce((sum, entry) => sum + entry[key], 0);
  const nFinishedSessions = total("nFinished");
  const nUnfinishedSessions = total("nUnfinished");
  const nSessions = nFinishedSessions + nUnfinishedSessions;
  const nResponses = histogram.reduce(
    (sum, entry) =>
      sum + entry.nResponses * (entry.nFinished + entry.nUnfinished),
    0,
  );

  // How many sessions are still going after n responses, within each group
  const maxResponses = histogram.length
    ? histogram[histogram.length - 1].nResponses
    : 0;
  const retentionLength = Math.min(maxResponses, MAX_RETENTION_POINTS);
  const retention = [];
  let remainingFinished = nFinishedSessions;
  let remainingUnfinished = nUnfinishedSessions;
  for (let n = 1; n <= retentionLength; n++) {
    // Sessions with exactly n - 1 responses do not make it any further
    const droppedOut = histogram.find((entry) => entry.nResponses === n - 1);
    remainingFinished -= droppedOut?.nFinished ?? 0;
    remainingUnfinished -= droppedOut?.nUnfinished ?? 0;
    retention.push({
      nResponses: n,
      finished: share(remainingFinished, nFinishedSessions),
      unfinished: share(remainingUnfinished, nUnfinishedSessions),
    });
  }

  return {
    nSessions,
    nFinishedSessions,
    nResponses,
    meanResponsesPerSession: share(nResponses, nSessions),
    histogram,
    retention,
    retentionTruncated: maxResponses > retentionLength,
  };
}

// How many participants there are per number of sessions or studies. The
// aggregate is computed per participant, e.g. COUNT(*) for their sessions.
async function countParticipantsPer(
  sequelize: Sequelize,
  aggregate: string,
  filter: SqlFilter,
  // Only count the participants of the selected study, while still counting
  // all of their sessions
  onlyParticipantsOfStudy = false,
): Promise<Array<{ value: number; nParticipants: number }>> {
  const ofStudy = onlyParticipantsOfStudy
    ? `AND EXISTS (
         SELECT 1
         FROM "wwl_sessions" AS "ofStudy"
         WHERE "ofStudy"."participantId" = "wwl_sessions"."participantId"
           AND "ofStudy"."studyId" = :studyId
       )`
    : "";

  const rows = await sequelize.query<{
    value: number | string;
    nParticipants: number | string;
  }>(
    `
      SELECT "value", COUNT(*) AS "nParticipants"
      FROM (
        SELECT "participantId", ${aggregate} AS "value"
        FROM "wwl_sessions"
        ${filter.sql}
        AND "participantId" IS NOT NULL
        ${ofStudy}
        GROUP BY "participantId"
      ) AS "participants"
      GROUP BY "value"
      ORDER BY "value"
    `,
    { replacements: filter.replacements, type: QueryTypes.SELECT },
  );

  return rows.map((row) => ({
    value: toNumber(row.value),
    nParticipants: toNumber(row.nParticipants),
  }));
}

// How often participants take part, and how they move between studies. When a
// study is selected, this covers the participants of that study.
async function getParticipantStats(
  sequelize: Sequelize,
  options: StatsOptions = {},
): Promise<ParticipantStats> {
  const { studyId } = options;
  // Sessions of the selected study, or all sessions
  const filter = sessionFilter(options);
  // All of a participant's sessions, no matter which study they are in
  const anyStudy = sessionFilter({ days: options.days });
  const replacements = { ...anyStudy.replacements, ...filter.replacements };

  const [sessionCounts, studyCounts, repeatedStudyRows, transitionRows] =
    await Promise.all([
      // Sessions of the selected study, or all sessions of a participant
      countParticipantsPer(sequelize, "COUNT(*)", filter),
      // The studies of the participants in scope, always all of them
      countParticipantsPer(
        sequelize,
        'COUNT(DISTINCT "studyId")',
        { sql: anyStudy.sql, replacements },
        Boolean(studyId),
      ),
      // Participants who have taken part in the same study more than once
      sequelize.query<{ nParticipants: number | string }>(
        `
          SELECT COUNT(DISTINCT "participantId") AS "nParticipants"
          FROM (
            SELECT "participantId"
            FROM "wwl_sessions"
            ${filter.sql}
            AND "participantId" IS NOT NULL
            GROUP BY "participantId", "studyId"
            HAVING COUNT(*) > 1
          ) AS "repeated"
        `,
        { replacements: filter.replacements, type: QueryTypes.SELECT },
      ),
      // Sessions which are in a different study than a participant's previous
      // one. The selected study is only used to pick the transitions it is
      // part of, so that moves in both directions are visible.
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
            ${anyStudy.sql}
            AND "participantId" IS NOT NULL
          ) AS "transitions"
          WHERE "previousStudyId" IS NOT NULL
            AND "previousStudyId" <> "studyId"
            ${studyId ? 'AND (:studyId IN ("previousStudyId", "studyId"))' : ""}
          GROUP BY "previousStudyId", "studyId"
          ORDER BY COUNT(*) DESC, "previousStudyId", "studyId"
        `,
        { replacements, type: QueryTypes.SELECT },
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

// Every study there is, in the order they are shown in the picker
async function getStudyIds(sequelize: Sequelize): Promise<Array<string>> {
  const rows = await sequelize.query<{ studyId: string }>(
    'SELECT "studyId" FROM "wwl_studies" ORDER BY "studyId"',
    { type: QueryTypes.SELECT },
  );
  return rows.map((row) => row.studyId);
}

// Compute all statistics at once. Without a study this is the overview across
// all studies, with one it is the more detailed view of that study.
async function getStats(
  sequelize: Sequelize,
  options: StatsOptions = {},
): Promise<Stats> {
  const days = sanitizeTimeframe(options.days);
  const { studyId } = options;
  const statsOptions = { ...options, days };

  const [studyIds, sessionsOverTime, participants, recruitment] =
    await Promise.all([
      getStudyIds(sequelize),
      getSessionsOverTime(sequelize, statsOptions),
      getParticipantStats(sequelize, statsOptions),
      getRecruitment(sequelize, statsOptions),
    ]);

  const stats: Stats = {
    options: { studyId: studyId ?? null, days },
    studyIds,
    sessionsOverTime,
    participants,
    recruitment,
  };

  if (studyId) {
    // How far participants get is only of interest within a single study,
    // since studies differ in how many responses they collect
    const [studies, responsesPerSession] = await Promise.all([
      getStudyStats(sequelize, statsOptions),
      getResponsesPerSession(sequelize, statsOptions),
    ]);
    stats.study = studies[0];
    stats.responsesPerSession = responsesPerSession;
  } else {
    stats.studies = await getStudyStats(sequelize, statsOptions);
  }

  return stats;
}

export {
  type StatsOptions,
  type Stats,
  type ParticipantStats,
  type RecruitmentStats,
  type RecruitmentBreakdown,
  type ResponsesPerSessionStats,
  type SessionsOverTimeEntry,
  type StudyStatsEntry,
  type ValueCountEntry,
  getStats,
  getStudyStats,
  getParticipantStats,
  getRecruitment,
  getResponsesPerSession,
  getSessionsOverTime,
  sanitizeTimeframe,
};
