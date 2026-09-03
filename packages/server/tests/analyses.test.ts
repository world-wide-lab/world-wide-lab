// Set up fake environment variables
import "./setup_env";

import {
  getAnalyses,
  getCompletionByStudy,
  getDurationByStudy,
  getParticipantLinking,
  getRecruitment,
  getResponsesPerSession,
  getSessionsOverTime,
  sanitizeTimeframe,
} from "../src/analyses";
import sequelize from "../src/db";

const STUDY_A = "analyses-a";
const STUDY_B = "analyses-b";
const STUDY_OLD = "analyses-old";

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

// Set up a small, fully deterministic data set to run the analyses on
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

  // A session from long ago, to check the timeframe of analyses over time
  await createSession({
    studyId: STUDY_OLD,
    finished: false,
    createdAt: daysAgo(100),
  });
}

function sumOf<T>(entries: Array<T>, key: keyof T): number {
  return entries.reduce((sum, entry) => sum + Number(entry[key]), 0);
}

describe("Analyses", () => {
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

  describe("Completion between Studies", () => {
    it("should compute the completion rate of every study", async () => {
      const entries = await getCompletionByStudy(sequelize);

      expect(entries).toEqual([
        {
          studyId: STUDY_A,
          nSessions: 4,
          nFinished: 3,
          completionRate: 0.75,
        },
        {
          studyId: STUDY_B,
          nSessions: 2,
          nFinished: 1,
          completionRate: 0.5,
        },
        {
          studyId: STUDY_OLD,
          nSessions: 1,
          nFinished: 0,
          completionRate: 0,
        },
      ]);
    });
  });

  describe("Responses per Session", () => {
    it("should compute how many responses sessions have", async () => {
      const analysis = await getResponsesPerSession(sequelize);

      expect(analysis.nSessions).toBe(7);
      expect(analysis.nResponses).toBe(10);
      expect(analysis.meanResponsesPerSession).toBe(10 / 7);
      expect(analysis.histogram).toEqual([
        { nResponses: 0, nSessions: 2 },
        { nResponses: 1, nSessions: 1 },
        { nResponses: 2, nSessions: 3 },
        { nResponses: 3, nSessions: 1 },
      ]);
    });

    it("should compute how many sessions make it past n responses", async () => {
      const analysis = await getResponsesPerSession(sequelize);

      expect(analysis.retentionTruncated).toBe(false);
      expect(analysis.retention).toEqual([
        { nResponses: 1, nSessions: 5, share: 5 / 7 },
        { nResponses: 2, nSessions: 4, share: 4 / 7 },
        { nResponses: 3, nSessions: 1, share: 1 / 7 },
      ]);
    });

    it("should only count sessions of the selected study", async () => {
      const analysis = await getResponsesPerSession(sequelize, {
        studyId: STUDY_A,
      });

      expect(analysis.nSessions).toBe(4);
      expect(analysis.nResponses).toBe(7);
      expect(analysis.histogram).toEqual([
        { nResponses: 0, nSessions: 1 },
        { nResponses: 2, nSessions: 2 },
        { nResponses: 3, nSessions: 1 },
      ]);
    });
  });

  describe("Session Duration", () => {
    it("should compute the duration of sessions per study", async () => {
      const entries = await getDurationByStudy(sequelize);

      // Studies without any responses can not be timed at all
      expect(entries.map((entry) => entry.studyId)).toEqual([STUDY_A, STUDY_B]);

      const [studyA, studyB] = entries;
      expect(studyA.nSessions).toBe(3);
      expect(studyA.meanDurationSeconds).toBeCloseTo((300 + 120 + 120) / 3, 3);
      expect(studyA.maxDurationSeconds).toBeCloseTo(300, 3);

      expect(studyB.nSessions).toBe(2);
      expect(studyB.meanDurationSeconds).toBeCloseTo((120 + 60) / 2, 3);
      expect(studyB.maxDurationSeconds).toBeCloseTo(120, 3);
    });
  });

  describe("Participant Linking", () => {
    it("should count how often participants take part", async () => {
      const analysis = await getParticipantLinking(sequelize);

      expect(analysis.nParticipants).toBe(3);
      expect(analysis.nParticipantsWithMultipleSessions).toBe(2);
      expect(analysis.sessionsPerParticipant).toEqual([
        { nSessions: 1, nParticipants: 1 },
        { nSessions: 2, nParticipants: 2 },
      ]);
    });

    it("should count participants repeating the same study", async () => {
      const analysis = await getParticipantLinking(sequelize);

      expect(analysis.nParticipantsRepeatingAStudy).toBe(1);
    });

    it("should count participants taking part in different studies", async () => {
      const analysis = await getParticipantLinking(sequelize);

      expect(analysis.nParticipantsWithMultipleStudies).toBe(1);
      expect(analysis.studiesPerParticipant).toEqual([
        { nStudies: 1, nParticipants: 2 },
        { nStudies: 2, nParticipants: 1 },
      ]);
    });

    it("should count participants moving from one study to another", async () => {
      const analysis = await getParticipantLinking(sequelize);

      expect(analysis.studyTransitions).toEqual([
        { fromStudyId: STUDY_A, toStudyId: STUDY_B, nTransitions: 1 },
      ]);
    });
  });

  describe("Recruitment", () => {
    it("should count where sessions have been started", async () => {
      const { bySourceUrl } = await getRecruitment(sequelize);

      // Query parameters are stripped from the source URL
      expect(bySourceUrl.entries).toEqual([
        { value: "https://study.org/a", nSessions: 3, share: 3 / 7 },
        { value: "(unknown)", nSessions: 2, share: 2 / 7 },
        { value: "https://study.org/b", nSessions: 2, share: 2 / 7 },
      ]);
      expect(bySourceUrl.truncated).toBe(false);
    });

    it("should count referrers by their origin", async () => {
      const { byReferrer } = await getRecruitment(sequelize);

      expect(byReferrer.entries).toEqual([
        { value: "(none / direct)", nSessions: 3, share: 3 / 7 },
        { value: "https://example.org", nSessions: 3, share: 3 / 7 },
        { value: "https://social.example", nSessions: 1, share: 1 / 7 },
      ]);
    });

    it("should count recruitment parameters in the source URL", async () => {
      const { bySourceParameter } = await getRecruitment(sequelize);

      expect(bySourceParameter.entries).toEqual([
        { value: "(unknown)", nSessions: 4, share: 4 / 7 },
        { value: "newsletter", nSessions: 2, share: 2 / 7 },
        { value: "social", nSessions: 1, share: 1 / 7 },
      ]);
    });

    it("should only count sessions of the selected study", async () => {
      const { bySourceUrl } = await getRecruitment(sequelize, {
        studyId: STUDY_B,
      });

      expect(bySourceUrl.entries).toEqual([
        { value: "https://study.org/b", nSessions: 2, share: 1 },
      ]);
      expect(bySourceUrl.nDistinctValues).toBe(1);
    });
  });

  describe("All Analyses", () => {
    it("should run every analysis at once", async () => {
      const analyses = await getAnalyses(sequelize, { studyId: STUDY_A });

      expect(analyses.options).toEqual({ studyId: STUDY_A, days: 30 });
      expect(analyses.studyIds).toEqual([STUDY_A, STUDY_B, STUDY_OLD]);
      expect(analyses.sessionsOverTime).toHaveLength(30);
      expect(analyses.completionByStudy).toHaveLength(3);
      expect(analyses.responsesPerSession.nSessions).toBe(4);
      expect(analyses.durationByStudy).toHaveLength(2);
      expect(analyses.participantLinking.nParticipants).toBe(3);
      // The URL used for the three sessions of study A plus the session
      // without any metadata
      expect(analyses.recruitment.bySourceUrl.entries).toEqual([
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
