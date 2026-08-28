import sequelize from "../../src/db/index.js";
import {
  api,
  createLeaderboard,
  createSession,
  createStudy,
  useTestDatabase,
} from "../helpers/index.js";

// The unit tests for the sanitizeNullBytes helper itself live in
// tests/sanitization.test.ts. These tests check that the endpoints accepting
// free-form data actually run their input through it, since postgres rejects
// null bytes inside JSON values.

const NUL = "\u0000";

beforeAll(useTestDatabase);

describe("Null byte sanitization", () => {
  it("should sanitize null bytes in participant data", async () => {
    const response = await api.post("/v1/participant").send({
      privateInfo: { contact: `email${NUL}@example.com` },
      publicInfo: { username: `user${NUL}name` },
    });

    expect(response.status).toBe(200);

    const participant = await sequelize.models.Participant.findOne({
      where: { participantId: response.body.participantId },
    });
    expect(participant).toHaveProperty(
      "privateInfo.contact",
      "email@example.com",
    );
    expect(participant).toHaveProperty("publicInfo.username", "username");
  });

  it("should sanitize null bytes in session data and metadata", async () => {
    const studyId = await createStudy();

    const response = await api.post("/v1/session").send({
      studyId,
      privateInfo: { notes: `Private${NUL}Notes` },
      publicInfo: { status: `In${NUL}Progress` },
      clientMetadata: { userAgent: `Test${NUL}Browser` },
    });

    expect(response.status).toBe(200);

    const session = await sequelize.models.Session.findOne({
      where: { sessionId: response.body.sessionId },
    });
    expect(session).toHaveProperty("privateInfo.notes", "PrivateNotes");
    expect(session).toHaveProperty("publicInfo.status", "InProgress");
    expect(session?.getDataValue("metadata").client.userAgent).toBe(
      "TestBrowser",
    );
  });

  it("should sanitize null bytes in nested response payloads", async () => {
    const sessionId = await createSession();

    const response = await api.post("/v1/response").send({
      sessionId,
      name: `test${NUL}_response`,
      payload: {
        answer: `John${NUL}Doe`,
        nestedData: {
          field1: `nested${NUL}value`,
          array: [`item${NUL}1`, `item${NUL}2`],
        },
      },
    });

    expect(response.status).toBe(200);

    const savedResponse = await sequelize.models.Response.findOne({
      where: { responseId: response.body.responseId },
    });
    expect(savedResponse).toHaveProperty("name", "test_response");
    expect(savedResponse).toHaveProperty("payload.answer", "JohnDoe");
    expect(savedResponse).toHaveProperty(
      "payload.nestedData.field1",
      "nestedvalue",
    );
    expect(savedResponse).toHaveProperty("payload.nestedData.array", [
      "item1",
      "item2",
    ]);
  });

  it("should sanitize null bytes in leaderboard scores", async () => {
    const leaderboardId = await createLeaderboard();
    const sessionId = await createSession();

    const response = await api
      .post(`/v1/leaderboard/${leaderboardId}/score`)
      .send({
        score: 100,
        publicIndividualName: `Player${NUL}One`,
        publicGroupName: `Team${NUL}Alpha`,
        sessionId,
      });

    expect(response.status).toBe(200);

    const score = await sequelize.models.LeaderboardScore.findOne({
      where: { leaderboardScoreId: response.body.leaderboardScoreId },
    });
    expect(score).toHaveProperty("publicIndividualName", "PlayerOne");
    expect(score).toHaveProperty("publicGroupName", "TeamAlpha");
  });
});
