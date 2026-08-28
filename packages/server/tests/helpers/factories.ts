import sequelize from "../../src/db/index.js";
import { useTestDatabase } from "./db.js";

/**
 * Factories to build test data directly in the database.
 *
 * Two rules make tests written with these helpers independent of each other
 * and of the order they run in:
 *
 *  1. Every identifier is unique, so two tests can never see each other's data
 *     even though they share a database.
 *  2. Each test creates exactly the data it asserts on, so the expected values
 *     are visible in the test itself instead of being the accumulated result of
 *     everything that ran before it.
 *
 * Writing fixtures straight to the database (rather than through the API) is
 * also considerably faster and keeps the "arrange" part of a test out of the
 * code paths that the test is meant to exercise.
 */

// A UUID that is syntactically valid but will never exist in the database.
const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";
// A studyId that is syntactically valid but will never exist in the database.
const NON_EXISTENT_STUDY_ID = "non-existent-study";

let counter = 0;

/**
 * A unique identifier that is accepted by the `^[a-zA-Z0-9-_]+$` validation
 * used for studyIds and leaderboardIds.
 */
function uniqueId(prefix = "test"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

interface JsonObject {
  [key: string]: unknown;
}

interface StudyOptions {
  studyId?: string;
  privateInfo?: JsonObject;
  publicInfo?: JsonObject;
}

async function createStudy(options: StudyOptions = {}): Promise<string> {
  await useTestDatabase();
  const studyId = options.studyId ?? uniqueId("study");
  await sequelize.models.Study.create({ ...options, studyId });
  return studyId;
}

interface ParticipantOptions {
  privateInfo?: JsonObject;
  publicInfo?: JsonObject;
}

async function createParticipant(
  options: ParticipantOptions = {},
): Promise<string> {
  await useTestDatabase();
  const participant = await sequelize.models.Participant.create({ ...options });
  return participant.getDataValue("participantId");
}

interface SessionOptions {
  studyId?: string;
  participantId?: string;
  finished?: boolean;
  privateInfo?: JsonObject;
  publicInfo?: JsonObject;
  metadata?: JsonObject;
}

async function createSession(options: SessionOptions = {}): Promise<string> {
  await useTestDatabase();
  const studyId = options.studyId ?? (await createStudy());
  const session = await sequelize.models.Session.create({
    ...options,
    studyId,
  });
  return session.getDataValue("sessionId");
}

interface ResponseOptions {
  sessionId: string;
  name?: string;
  payload?: JsonObject | null;
}

async function createResponse(options: ResponseOptions): Promise<number> {
  await useTestDatabase();
  const response = await sequelize.models.Response.create({
    name: "test_trial",
    payload: { key_1: "value 1", key_2: "value 2" },
    ...options,
  });
  return response.getDataValue("responseId");
}

interface LeaderboardOptions {
  leaderboardId?: string;
  studyId?: string;
  privateInfo?: JsonObject;
}

async function createLeaderboard(
  options: LeaderboardOptions = {},
): Promise<string> {
  await useTestDatabase();
  const leaderboardId = options.leaderboardId ?? uniqueId("leaderboard");
  await sequelize.models.Leaderboard.create({ ...options, leaderboardId });
  return leaderboardId;
}

interface LeaderboardScoreOptions {
  leaderboardId: string;
  sessionId: string;
  score: number;
  publicIndividualName?: string;
  publicGroupName?: string;
}

async function createLeaderboardScore(
  options: LeaderboardScoreOptions,
): Promise<number> {
  await useTestDatabase();
  const score = await sequelize.models.LeaderboardScore.create({ ...options });
  return score.getDataValue("leaderboardScoreId");
}

interface SessionSpec {
  /** How many responses to create for this session. Defaults to 0. */
  responses?: number;
  /** Payload used for every response of this session. */
  payload?: JsonObject | null;
  /** Name used for every response of this session. */
  name?: string;
  finished?: boolean;
  /** Set to false to create a session that is not linked to a participant. */
  participant?: boolean;
}

interface StudyScenarioSpec {
  studyId?: string;
  sessions?: SessionSpec[];
}

interface StudyScenario {
  studyId: string;
  /** The participant shared by all sessions that asked for one. */
  participantId: string;
  sessions: Array<{ sessionId: string; responseIds: number[] }>;
  /** Convenience accessor for `sessions[0].sessionId`. */
  sessionId: string;
}

/**
 * Create a whole study in one call, so that a test can state its preconditions
 * declaratively instead of building them up through a chain of earlier tests.
 *
 * ```ts
 * const study = await seedStudy({
 *   sessions: [{ finished: true, responses: 3 }, { responses: 1 }],
 * });
 * ```
 */
async function seedStudy(spec: StudyScenarioSpec = {}): Promise<StudyScenario> {
  const studyId = await createStudy({ studyId: spec.studyId });
  const participantId = await createParticipant();

  const sessions = [];
  for (const sessionSpec of spec.sessions ?? []) {
    const sessionId = await createSession({
      studyId,
      participantId:
        sessionSpec.participant === false ? undefined : participantId,
      finished: sessionSpec.finished ?? false,
    });

    const responseIds = [];
    for (let i = 0; i < (sessionSpec.responses ?? 0); i++) {
      responseIds.push(
        await createResponse({
          sessionId,
          ...(sessionSpec.name !== undefined ? { name: sessionSpec.name } : {}),
          ...(sessionSpec.payload !== undefined
            ? { payload: sessionSpec.payload }
            : {}),
        }),
      );
    }
    sessions.push({ sessionId, responseIds });
  }

  return {
    studyId,
    participantId,
    sessions,
    sessionId: sessions[0]?.sessionId,
  };
}

export {
  NON_EXISTENT_STUDY_ID,
  NON_EXISTENT_UUID,
  createLeaderboard,
  createLeaderboardScore,
  createParticipant,
  createResponse,
  createSession,
  createStudy,
  seedStudy,
  uniqueId,
};
export type { StudyScenario };
