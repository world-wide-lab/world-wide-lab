// Set up fake environment variables
import "./setup_env";

import sequelize from "../src/db";
import {
  getParticipantLinking,
  getRecruitment,
  getResponsesPerSession,
  getSessionsOverTime,
  getStats,
  getStudyStats,
  sanitizeTimeframe,
} from "../src/stats";

const STUDY_A = "stats-a";
const STUDY_B = "stats-b";
const STUDY_OLD = "stats-old";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const now = Date.now();
function minutesAgo(minutes: number): Date {
  return new Date(now - minutes * MINUTE);
}
function daysAgo(days: number): Date {
  return new Date(now - days * DAY);
}

async function createSession(options: {
  studyId: string;
  participantId?: string;
  finished?: boolean;
  createdAt: Date;
  metadata?: object | null;
  // Point in time of the last response, responses are spread out evenly
  // between the start of the session and this timestamp.
  responses?: { n: number; lastResponseAt: Date };
}) {
  const session: any = await sequelize.models.Session.create({
    studyId: options.studyId,
    participantId: options.participantId,
    finished: options.finished ?? false,
    createdAt: options.createdAt,
    metadata: options.metadata ?? null,
  });

  const { n = 0, lastResponseAt } = options.responses ?? { n: 0 };
  for (let index = 1; index <= n; index++) {
    const createdAt = new Date(
      options.createdAt.getTime() +
        ((lastResponseAt as Date).getTime() - options.createdAt.getTime()) *
          (index / n),
    );
    await sequelize.models.Response.create({
      sessionId: session.sessionId,
      name: `trial-${index}`,
      payload: { index },
      createdAt,
    });
  }

  return session;
}

async function createParticipant(): Promise<string> {
  const participant: any = await sequelize.models.Participant.create({});
  return participant.participantId;
}

// Set up a small, fully deterministic data set to compute the statistics on
async function generateData() {
  for (const studyId of [STUDY_A, STUDY_B, STUDY_OLD]) {
    await sequelize.models.Study.create({ studyId });
  }

  // Participant #1: takes part in study A and then moves on to study B
  const participant1 = await createParticipant();
  await createSession({
    studyId: STUDY_A,
    participantId: participant1,
    finished: true,
    createdAt: minutesAgo(120),
    responses: { n: 3, lastResponseAt: minutesAgo(115) },
    metadata: {
      referer: "https://example.org/blog/post",
      client: {
        url: "https://study.org/a?source=newsletter&PROLIFIC_PID=1",
        searchParams: { source: "newsletter", PROLIFIC_PID: "1" },
      },
    },
  });
  await createSession({
    studyId: STUDY_B,
    participantId: participant1,
    finished: false,
    createdAt: minutesAgo(110),
    responses: { n: 1, lastResponseAt: minutesAgo(108) },
    metadata: {
      referer: "https://example.org/other",
      client: {
        url: "https://study.org/b?source=newsletter",
        searchParams: { source: "newsletter" },
      },
    },
  });

  // Participant #2: takes part in study A twice
  const participant2 = await createParticipant();
  await createSession({
    studyId: STUDY_A,
    participantId: participant2,
    finished: true,
    createdAt: minutesAgo(100),
    responses: { n: 2, lastResponseAt: minutesAgo(98) },
    metadata: {
      referer: "https://social.example/x",
      client: {
        url: "https://study.org/a?utm_source=social",
        searchParams: { utm_source: "social" },
      },
    },
  });
  await createSession({
    studyId: STUDY_A,
    participantId: participant2,
    finished: true,
    createdAt: minutesAgo(90),
    responses: { n: 2, lastResponseAt: minutesAgo(88) },
    metadata: { client: { url: "https://study.org/a" } },
  });

  // Participant #3: drops out before giving any responses
  const participant3 = await createParticipant();
  await createSession({
    studyId: STUDY_A,
    participantId: participant3,
    finished: false,
    createdAt: minutesAgo(80),
  });

  // A session without a linked participant
  await createSession({
    studyId: STUDY_B,
    finished: true,
    createdAt: minutesAgo(70),
    responses: { n: 2, lastResponseAt: minutesAgo(69) },
    metadata: {
      referer: "https://example.org/blog/post",
      client: { url: "https://study.org/b" },
    },
  });

  // A session from long ago, to check the timeframe of the statistics
  await createSession({
    studyId: STUDY_OLD,
    finished: false,
    createdAt: daysAgo(100),
  });
}

function sumOf<T>(entries: Array<T>, key: keyof T): number {
  return entries.reduce((sum, entry) => sum + Number(entry[key]), 0);
}

describe("Stats", () => {
  beforeAll(async () => {
    await sequelize.sync();
    await generateData();
  });

  describe("Sessions over Time", () => {
    it("should count sessions per day within the given timeframe", async () => {
      const entries = await getSessionsOverTime(sequelize, { days: 30 });

      expect(entries).toHaveLength(30);
      // The session from 100 days ago is outside of the timeframe
      expect(sumOf(entries, "nSessions")).toBe(6);
      expect(sumOf(entries, "nFinished")).toBe(4);
    });

    it("should include older sessions in a longer timeframe", async () => {
      const entries = await getSessionsOverTime(sequelize, { days: 365 });

      expect(entries).toHaveLength(365);
      expect(sumOf(entries, "nSessions")).toBe(7);
    });

    it("should fill up days without any sessions", async () => {
      const entries = await getSessionsOverTime(sequelize, { days: 30 });

      // Nothing happened 20 days ago
      const entry = entries[entries.length - 21];
      expect(entry.nSessions).toBe(0);
      expect(entry.nFinished).toBe(0);
      expect(entry.completionRate).toBe(null);
      // Days are returned in order, without any gaps
      const dates = entries.map((entry) => entry.date);
      expect([...dates].sort()).toEqual(dates);
    });

    it("should compute the completion rate per day", async () => {
      const entries = await getSessionsOverTime(sequelize, { days: 30 });

      const withSessions = entries.filter((entry) => entry.nSessions > 0);
      for (const entry of withSessions) {
        expect(entry.completionRate).toBe(entry.nFinished / entry.nSessions);
      }
    });

    it("should only count sessions of the selected study", async () => {
      const entries = await getSessionsOverTime(sequelize, {
        days: 30,
        studyId: STUDY_B,
      });

      expect(sumOf(entries, "nSessions")).toBe(2);
      expect(sumOf(entries, "nFinished")).toBe(1);
    });
  });

  describe("Studies", () => {
    it("should compute the sessions, completion and duration per study", async () => {
      const entries = await getStudyStats(sequelize);

      expect(entries.map((entry) => entry.studyId)).toEqual([
        STUDY_A,
        STUDY_B,
        STUDY_OLD,
      ]);

      const [studyA, studyB, studyOld] = entries;
      expect(studyA.nSessions).toBe(4);
      expect(studyA.nFinished).toBe(3);
      expect(studyA.completionRate).toBe(0.75);
      // The session without any responses can not be timed
      expect(studyA.nTimedSessions).toBe(3);
      expect(studyA.meanDurationSeconds).toBeCloseTo((300 + 120 + 120) / 3, 3);

      expect(studyB.nSessions).toBe(2);
      expect(studyB.nFinished).toBe(1);
      expect(studyB.completionRate).toBe(0.5);
      expect(studyB.nTimedSessions).toBe(2);
      expect(studyB.meanDurationSeconds).toBeCloseTo((120 + 60) / 2, 3);

      // Studies without any responses have no duration at all
      expect(studyOld.nSessions).toBe(1);
      expect(studyOld.completionRate).toBe(0);
      expect(studyOld.nTimedSessions).toBe(0);
      expect(studyOld.meanDurationSeconds).toBe(null);
    });
  });

  describe("Responses per Session", () => {
    it("should compute how many responses sessions have", async () => {
      const stats = await getResponsesPerSession(sequelize);

      // The session from 100 days ago is outside of the default timeframe
      expect(stats.nSessions).toBe(6);
      expect(stats.nResponses).toBe(10);
      expect(stats.meanResponsesPerSession).toBe(10 / 6);
      expect(stats.histogram).toEqual([
        { nResponses: 0, nSessions: 1 },
        { nResponses: 1, nSessions: 1 },
        { nResponses: 2, nSessions: 3 },
        { nResponses: 3, nSessions: 1 },
      ]);
    });

    it("should only count sessions within the timeframe", async () => {
      const stats = await getResponsesPerSession(sequelize, { days: 365 });

      expect(stats.nSessions).toBe(7);
      expect(stats.histogram[0]).toEqual({ nResponses: 0, nSessions: 2 });
    });

    it("should compute how many sessions make it past n responses", async () => {
      const stats = await getResponsesPerSession(sequelize);

      expect(stats.retentionTruncated).toBe(false);
      expect(stats.retention).toEqual([
        { nResponses: 1, nSessions: 5, share: 5 / 6 },
        { nResponses: 2, nSessions: 4, share: 4 / 6 },
        { nResponses: 3, nSessions: 1, share: 1 / 6 },
      ]);
    });

    it("should only count sessions of the selected study", async () => {
      const stats = await getResponsesPerSession(sequelize, {
        studyId: STUDY_A,
      });

      expect(stats.nSessions).toBe(4);
      expect(stats.nResponses).toBe(7);
      expect(stats.histogram).toEqual([
        { nResponses: 0, nSessions: 1 },
        { nResponses: 2, nSessions: 2 },
        { nResponses: 3, nSessions: 1 },
      ]);
    });
  });

  describe("Participant Linking", () => {
    it("should count how often participants take part", async () => {
      const stats = await getParticipantLinking(sequelize);

      expect(stats.nParticipants).toBe(3);
      expect(stats.nParticipantsWithMultipleSessions).toBe(2);
      expect(stats.sessionsPerParticipant).toEqual([
        { nSessions: 1, nParticipants: 1 },
        { nSessions: 2, nParticipants: 2 },
      ]);
    });

    it("should count participants repeating the same study", async () => {
      const stats = await getParticipantLinking(sequelize);

      expect(stats.nParticipantsRepeatingAStudy).toBe(1);
    });

    it("should count participants taking part in different studies", async () => {
      const stats = await getParticipantLinking(sequelize);

      expect(stats.nParticipantsWithMultipleStudies).toBe(1);
      expect(stats.studiesPerParticipant).toEqual([
        { nStudies: 1, nParticipants: 2 },
        { nStudies: 2, nParticipants: 1 },
      ]);
    });

    it("should count participants moving from one study to another", async () => {
      const stats = await getParticipantLinking(sequelize);

      expect(stats.studyTransitions).toEqual([
        { fromStudyId: STUDY_A, toStudyId: STUDY_B, nTransitions: 1 },
      ]);
    });
  });

  describe("Recruitment", () => {
    it("should count where sessions have been started", async () => {
      const { bySourceUrl } = await getRecruitment(sequelize);

      // Query parameters are stripped from the source URL
      expect(bySourceUrl.entries).toEqual([
        { value: "https://study.org/a", nSessions: 3, share: 3 / 6 },
        { value: "https://study.org/b", nSessions: 2, share: 2 / 6 },
        { value: "(unknown)", nSessions: 1, share: 1 / 6 },
      ]);
      expect(bySourceUrl.truncated).toBe(false);
    });

    it("should count referrers by their origin", async () => {
      const { byReferrer } = await getRecruitment(sequelize);

      expect(byReferrer.entries).toEqual([
        { value: "https://example.org", nSessions: 3, share: 3 / 6 },
        { value: "(none / direct)", nSessions: 2, share: 2 / 6 },
        { value: "https://social.example", nSessions: 1, share: 1 / 6 },
      ]);
    });

    it("should count recruitment parameters in the source URL", async () => {
      const { bySourceParameter } = await getRecruitment(sequelize);

      expect(bySourceParameter.entries).toEqual([
        { value: "(unknown)", nSessions: 3, share: 3 / 6 },
        { value: "newsletter", nSessions: 2, share: 2 / 6 },
        { value: "social", nSessions: 1, share: 1 / 6 },
      ]);
    });

    it("should only count sessions of the selected study", async () => {
      const { bySourceUrl } = await getRecruitment(sequelize, {
        studyId: STUDY_B,
      });

      expect(bySourceUrl.entries).toEqual([
        { value: "https://study.org/b", nSessions: 2, share: 1 },
      ]);
    });
  });

  describe("All Stats", () => {
    it("should compute every statistic at once", async () => {
      const stats = await getStats(sequelize, { studyId: STUDY_A });

      expect(stats.options).toEqual({ studyId: STUDY_A, days: 30 });
      expect(stats.studyIds).toEqual([STUDY_A, STUDY_B, STUDY_OLD]);
      expect(stats.sessionsOverTime).toHaveLength(30);
      expect(stats.studies).toHaveLength(3);
      expect(stats.responsesPerSession.nSessions).toBe(4);
      expect(stats.participantLinking.nParticipants).toBe(3);
      // The URL used for the three sessions of study A plus the session
      // without any metadata
      expect(stats.recruitment.bySourceUrl.entries).toEqual([
        { value: "https://study.org/a", nSessions: 3, share: 0.75 },
        { value: "(unknown)", nSessions: 1, share: 0.25 },
      ]);
    });

    it("should only accept sensible timeframes", () => {
      expect(sanitizeTimeframe(7)).toBe(7);
      expect(sanitizeTimeframe("7")).toBe(7);
      expect(sanitizeTimeframe(7.5)).toBe(7);
      expect(sanitizeTimeframe(undefined)).toBe(30);
      expect(sanitizeTimeframe("not-a-number")).toBe(30);
      expect(sanitizeTimeframe(-1)).toBe(30);
      expect(sanitizeTimeframe(100000)).toBe(365);
    });
  });
});
