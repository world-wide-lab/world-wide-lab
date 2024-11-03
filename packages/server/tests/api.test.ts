// Set up fake environment variables
import "./setup_env";

import request from "supertest";
import app from "../src/app";
import sequelize from "../src/db";

import { version } from "../package.json";

const STUDY_ID = "abc123";
const API_KEY = process.env.DEFAULT_API_KEY;

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

const endpoint = request(app);

describe("API Routes", () => {
  beforeAll(async () => {
    // Initialize Database
    await sequelize.sync();
  });

  // afterAll(async () => {
  //   // TODO: Clean up any test data
  // });

  let participantId: string;
  let sessionId: string;
  const studyId: string = STUDY_ID;

  describe("POST /participant", () => {
    it("should create a new participant", async () => {
      const response = await endpoint.post("/v1/participant").send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("participantId");

      // Set the shared participantId
      participantId = response.body.participantId;
    });
  });

  describe("PUT /participant/:participantId", () => {
    it("should update an existing participant", async () => {
      const response = await endpoint
        .put(`/v1/participant/${participantId}`)
        .send({
          privateInfo: { lorem: "ipsum" },
          publicInfo: { participantHasDoneSomething: true },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const user = await sequelize.models.Participant.findOne({
        where: { participantId },
      });
      expect(user).toHaveProperty("privateInfo", { lorem: "ipsum" });
      expect(user).toHaveProperty("publicInfo", {
        participantHasDoneSomething: true,
      });
    });

    it("should fail when the participant does not exist", async () => {
      const response = await endpoint
        .put(`/v1/participant/${NON_EXISTENT_UUID}`)
        .send({ privateInfo: { lorem: "ipsum" } });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the participant is invalid", async () => {
      const response = await endpoint
        .put("/v1/participant/" + "some-non-existing-ID")
        .send({ privateInfo: { lorem: "ipsum" } });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("GET /participant/:participantId", () => {
    it("should retrieve public information about a participant", async () => {
      const response = await endpoint
        .get(`/v1/participant/${participantId}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.participantId).toBe(participantId);
      response.body.participantId = "overwritten";
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the participant does not exist", async () => {
      const response = await endpoint
        .get(`/v1/participant/${NON_EXISTENT_UUID}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the participant is invalid", async () => {
      const response = await endpoint
        .get("/v1/participant/" + "non-existent-participant-id")
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("POST /study", () => {
    it("should create a new study", async () => {
      const response = await endpoint
        .post("/v1/study")
        .send({ studyId: STUDY_ID });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("studyId");
    });

    it("should create a new study with extra info", async () => {
      const response = await endpoint.post("/v1/study").send({
        studyId: `${STUDY_ID}_extra`,
        privateInfo: { integer: 10 },
        publicInfo: { string: "lorem" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("studyId");
    });

    it("should validate extra info", async () => {
      const response = await endpoint
        .post("/v1/study")
        .send({ studyId: `${STUDY_ID}_extra`, privateInfo: 10 });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("GET /study/list", () => {
    it("should return a list of studies", async () => {
      const response = await endpoint.get("/v1/study/list").send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe("POST /session", () => {
    it("should start a new session", async () => {
      const response = await endpoint
        .post("/v1/session")
        .send({ participantId, studyId });

      expect(response.status).toBe(200);

      // Set the shared sessionId
      sessionId = response.body.sessionId;
    });

    it("should start a new session with extra info", async () => {
      const response = await endpoint.post("/v1/session").send({
        participantId,
        studyId,
        privateInfo: { integer: 10 },
        publicInfo: { string: "lorem" },
        clientMetadata: { version: "1.0", queryParameters: { test: "test" } },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("sessionId");

      const session = await sequelize.models.Session.findOne({
        where: { sessionId: response.body.sessionId },
      });
      // @ts-ignore
      expect(session.metadata.wwl_version).toBe(version);
      // @ts-ignore
      session.metadata.wwl_version = "varying";
      // @ts-ignore
      expect(session.metadata).toMatchSnapshot();
    });

    it("missing studyId should lead to an error", async () => {
      const response = await endpoint
        .post("/v1/session")
        .send({ participantId });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
    it("missing participantId should be ok", async () => {
      const response = await endpoint.post("/v1/session").send({ studyId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("sessionId");
    });

    it("should validate extra info", async () => {
      const response = await endpoint
        .post("/v1/session")
        .send({ participantId, studyId, privateInfo: 10 });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("POST /session/finish", () => {
    it("should mark a session as finished", async () => {
      const response = await endpoint
        .post("/v1/session/finish")
        .send({ sessionId: sessionId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const session = await sequelize.models.Session.findOne({
        where: { sessionId },
      });
      expect(session).toHaveProperty("finished", true);
    });

    it("should fail when the session does not exist", async () => {
      const response = await endpoint
        .post("/v1/session/finish")
        .send({ sessionId: NON_EXISTENT_UUID });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the sessionId is invalid", async () => {
      const response = await endpoint
        .post("/v1/session/finish")
        .send({ sessionId: "non-existent" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("PUT /session/:sessionId", () => {
    it("should update a session", async () => {
      const response = await endpoint.put(`/v1/session/${sessionId}`).send({
        privateInfo: { lorem: "ipsum" },
        publicInfo: { dolor: "sit" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const session = await sequelize.models.Session.findOne({
        where: { sessionId },
      });
      expect(session).toHaveProperty("privateInfo", { lorem: "ipsum" });
      expect(session).toHaveProperty("publicInfo", { dolor: "sit" });
    });

    it("should fail when the session does not exist", async () => {
      const response = await endpoint
        .put(`/v1/session/${NON_EXISTENT_UUID}`)
        .send({ privateInfo: { lorem: "ipsum" } });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the sessionId is invalid", async () => {
      const response = await endpoint
        .put("/v1/session/" + "non-existent-session-id")
        .send({ privateInfo: { lorem: "ipsum" } });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("GET /session/:sessionId", () => {
    it("should retrieve public information about a session", async () => {
      const response = await endpoint.get(`/v1/session/${sessionId}`).send();

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe(sessionId);
      response.body.sessionId = "overwritten";
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the session does not exist", async () => {
      const response = await endpoint
        .get(`/v1/session/${NON_EXISTENT_UUID}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the sessionId is invalid", async () => {
      const response = await endpoint
        .get("/v1/session/" + "non-existent-session-id")
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("POST /response", () => {
    it("should submit a response", async () => {
      const response = await endpoint.post("/v1/response").send({
        sessionId,
        name: "test_trail",
        payload: {
          key_1: "value 1",
          key_2: "value 2",
        },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("responseId");
      const { responseId } = response.body;

      const sessionResponse = await sequelize.models.Response.findOne({
        where: { responseId },
      });
      expect(sessionResponse).toHaveProperty("sessionId", sessionId);
      expect(sessionResponse).toHaveProperty("name", "test_trail");
      expect(sessionResponse).toHaveProperty("payload", {
        key_1: "value 1",
        key_2: "value 2",
      });
    });

    it("should fail to submit a response when the session does not exist", async () => {
      const response = await endpoint.post("/v1/response").send({
        sessionId: NON_EXISTENT_UUID,
        name: "test_trail",
        payload: {
          key_1: "value 1",
          key_2: "value 2",
        },
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail to submit a response when the sessionId is invalid", async () => {
      const response = await endpoint.post("/v1/response").send({
        sessionId: "non-existent-session-id",
        name: "test_trail",
        payload: {
          key_1: "value 1",
          key_2: "value 2",
        },
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail to submit non-JSON payload", async () => {
      const response = await endpoint.post("/v1/response").send({
        sessionId,
        name: "test_trail",
        payload: "this-is-not-json",
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    // These extra responses are for the GET /study/* tests cases
    it("should store additional data", async () => {
      const exampleData = {
        name: "test_trail",
        payload: {
          key_1: "value 1",
          key_2: "value 2",
        },
      };
      // Two more responses for first session
      await endpoint.post("/v1/response").send({ sessionId, ...exampleData });
      await endpoint.post("/v1/response").send({ sessionId, ...exampleData });
      // And one additional responses in a new session
      const newSessionResponse = await endpoint
        .post("/v1/session")
        .send({ participantId, studyId });
      await endpoint
        .post("/v1/response")
        .send({ sessionId: newSessionResponse.body.sessionId, ...exampleData });
    });
  });

  describe("GET /study/:studyId/count/:countType", () => {
    it("should return the correct count (for all sessions)", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/count/all`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(4);
    });

    it("should return the correct count (for only finished sessions)", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/count/finished`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
    });

    it("should fail when the countType does not exist", async () => {
      // Don't pass on console.error message, as it is expected
      vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await endpoint
        .get(`/v1/study/${studyId}/count/non-existent-type`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the study does not exist", async () => {
      const response = await endpoint
        .get("/v1/study/non-existent-study/count/all")
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should cache counts", async () => {
      vi.spyOn(sequelize.models.Session, "count");

      // Call for the first time, where there should be no cache yet
      const response = await endpoint
        .get(`/v1/study/${studyId}/count/all?cacheFor=300`)
        .send();
      expect(vi.mocked(sequelize.models.Session.count).mock.calls).toHaveLength(
        1,
      );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(4);

      // Call for the second time, where where we should hit the cache
      const cachedResponse = await endpoint
        .get(`/v1/study/${studyId}/count/all?cacheFor=300`)
        .send();
      expect(vi.mocked(sequelize.models.Session.count).mock.calls).toHaveLength(
        1,
      );

      expect(cachedResponse.status).toBe(200);
      expect(cachedResponse.body.count).toBe(4);
    });
  });

  describe("GET /study/count-all/:countType", () => {
    it("should return the correct count (for all sessions)", async () => {
      const response = await endpoint.get("/v1/study/count-all/all").send();

      expect(response.status).toBe(200);
      expect(response.body[studyId]).toBe(4);

      expect(response.body).toMatchSnapshot();
    });

    it("should return the correct count (for finished sessions)", async () => {
      const response = await endpoint
        .get("/v1/study/count-all/finished")
        .send();

      expect(response.status).toBe(200);
      expect(response.body[studyId]).toBe(1);

      expect(response.body).toMatchSnapshot();
    });
  });

  describe("GET /study/:studyId/data/:dataType/json", () => {
    it("should download a raw list of responses", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/responses-raw/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(4);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download a raw list of sessions", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/sessions-raw/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(4);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download a raw list of participant", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(3);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download an extracted list of responses", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/responses-extracted-payload/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(4);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
      expect(response.body[0].key_1).toBe("value 1");
      expect(response.body[3].key_2).toBe("value 2");
    });

    it("should download an extracted list of responses (in CSV format)", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/responses-extracted-payload/csv`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      const lines = response.text.split(/\r\n|\r|\n/);
      expect(lines.length).toBe(4 + 1);
      expect(lines[0]).toMatchSnapshot();
    });

    it("should handle empty studies as well", async () => {
      const studyIdEmpty = "empty-study";
      // Create new empty study
      await endpoint.post("/v1/study").send({ studyId: studyIdEmpty });

      const response = await endpoint
        .get(`/v1/study/${studyIdEmpty}/data/responses-extracted-payload/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });

    it("should handle empty studies as well (in CSV format)", async () => {
      const studyIdEmpty = "empty-study-2";
      // Create new empty study
      await endpoint.post("/v1/study").send({ studyId: studyIdEmpty });

      const response = await endpoint
        .get(`/v1/study/${studyIdEmpty}/data/responses-extracted-payload/csv`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.text).toBe("");
    });

    it("should handle studies without payload as well", async () => {
      const studyIdNoPayload = "no-payload-study";
      // Create new empty study and add one session with one response
      await endpoint.post("/v1/study").send({ studyId: studyIdNoPayload });
      const sessionResponse = await endpoint
        .post("/v1/session")
        .send({ participantId, studyId: studyIdNoPayload });
      await endpoint
        .post("/v1/response")
        .send({ sessionId: sessionResponse.body.sessionId });

      const response = await endpoint
        .get(
          `/v1/study/${studyIdNoPayload}/data/responses-extracted-payload/json`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should require authentication", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw/json`)
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it("should require the correct API KEY", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw/json`)
        .set("Authorization", "Bearer wrong-key")
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the study does not exist", async () => {
      const response = await endpoint
        .get("/v1/study/non-existent-study/data/participants-raw/json")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("PUT /leaderboard/:leaderboardId/score", () => {
    const LEADERBOARD_ID = "test-leaderboard";

    beforeAll(async () => {
      // Create a leaderboard
      await sequelize.models.Leaderboard.create({
        leaderboardId: LEADERBOARD_ID,
      });
    });

    it("should successfully add a leaderboard score", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score`)
        .send({
          score: 100,
          publicIndividualName: "Sam Flynn",
          sessionId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty("leaderboardScoreId");
    });

    it("should reject a leaderboard score with an invalid sessionId", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score`)
        .send({
          score: 100,
          publicIndividualName: "Alan Bradley",
          sessionId: "invalidSessionId",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject a leaderboard score with an non-existing sessionId", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score`)
        .send({
          score: 100,
          publicIndividualName: "Lora Bradley",
          // Correct schema, but non-existent
          sessionId: "5e876f78-9b29-4692-9673-777da42fa144",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject a leaderboard score without a score", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score`)
        .send({
          publicIndividualName: "Ed Dillinger",
          sessionId,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PUT /leaderboard/:leaderboardId/score/:scoreId", () => {
    const LEADERBOARD_ID = "test-leaderboard-update";
    let leaderboardScoreId: number;

    beforeAll(async () => {
      // Create a leaderboard
      await sequelize.models.Leaderboard.create({
        leaderboardId: LEADERBOARD_ID,
      });

      // Add a score to the leaderboard
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score`)
        .send({
          score: 100,
          publicIndividualName: "Samwise Gamgee",
          sessionId,
        });

      leaderboardScoreId = response.body.leaderboardScoreId;
    });

    it("should successfully update a leaderboard score (without a name)", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score/${leaderboardScoreId}`)
        .send({
          score: 200,
          sessionId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const leaderboardResponse = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/individual`)
        .send();

      expect(leaderboardResponse.status).toBe(200);
      expect(leaderboardResponse.body.scores).toMatchObject([
        { score: 200, publicIndividualName: "Samwise Gamgee" },
      ]);
    });

    it("should successfully update a leaderboard score (with a name)", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score/${leaderboardScoreId}`)
        .send({
          score: 300,
          publicIndividualName: "Frodo Beutlin",
          sessionId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const leaderboardResponse = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/individual`)
        .send();

      expect(leaderboardResponse.status).toBe(200);
      expect(leaderboardResponse.body.scores).toMatchObject([
        { score: 300, publicIndividualName: "Frodo Beutlin" },
      ]);
    });

    it("should successfully add information to a leaderboard score", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score/${leaderboardScoreId}`)
        .send({
          score: 400,
          publicIndividualName: "Frodo Beutlin",
          publicGroupName: "Die Gefaehrten",
          sessionId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const leaderboardResponse = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/individual`)
        .send();

      expect(leaderboardResponse.status).toBe(200);
      expect(leaderboardResponse.body.scores).toMatchObject([
        {
          score: 400,
          publicIndividualName: "Frodo Beutlin",
          publicGroupName: "Die Gefaehrten",
        },
      ]);
    });

    it("should reject an update with a non-existing sessionId", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score/${leaderboardScoreId}`)
        .send({
          score: 200,
          publicIndividualName: "Sam Flynn",
          sessionId: "5e876f78-9b29-4692-9673-777da42fa144",
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject an update without a score", async () => {
      const response = await endpoint
        .put(`/v1/leaderboard/${LEADERBOARD_ID}/score/${leaderboardScoreId}`)
        .send({
          publicIndividualName: "Sam Flynn",
          sessionId,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /leaderboard/:leaderboardId/scores/:level", () => {
    const LEADERBOARD_ID = "test-leaderboard-2";

    beforeAll(async () => {
      // Create a leaderboard
      await sequelize.models.Leaderboard.create({
        leaderboardId: LEADERBOARD_ID,
      });
    });

    it("should successfully add a handful of scores", async () => {
      const scores = [
        { score: 100, publicIndividualName: "A", publicGroupName: "GRP-A" },
        { score: 200, publicIndividualName: "B", publicGroupName: "GRP-A" },
        { score: 300, publicIndividualName: "C", publicGroupName: "GRP-B" },
        { score: 400, publicIndividualName: "D", publicGroupName: "GRP-B" },
        { score: 500, publicIndividualName: "E", publicGroupName: "GRP-B" },
      ];
      for (let index = 0; index < scores.length; index++) {
        const scoreEntry = scores[index];
        const response = await endpoint
          .put(`/v1/leaderboard/${LEADERBOARD_ID}/score`)
          .send({
            sessionId,
            ...scoreEntry,
          });

        expect(response.status).toBe(200);
      }
    });

    it("should return individual scores", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/individual`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 500, publicIndividualName: "E", publicGroupName: "GRP-B" },
        { score: 400, publicIndividualName: "D", publicGroupName: "GRP-B" },
        { score: 300, publicIndividualName: "C", publicGroupName: "GRP-B" },
        { score: 200, publicIndividualName: "B", publicGroupName: "GRP-A" },
        { score: 100, publicIndividualName: "A", publicGroupName: "GRP-A" },
      ]);
    });

    it("should return individual scores (with explicit ordering)", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/individual?sort=desc`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 500, publicIndividualName: "E", publicGroupName: "GRP-B" },
        { score: 400, publicIndividualName: "D", publicGroupName: "GRP-B" },
        { score: 300, publicIndividualName: "C", publicGroupName: "GRP-B" },
        { score: 200, publicIndividualName: "B", publicGroupName: "GRP-A" },
        { score: 100, publicIndividualName: "A", publicGroupName: "GRP-A" },
      ]);
    });

    it("should return individual scores (with explicit ordering and a limit)", async () => {
      const timestamp = new Date();
      // Set to one hour ago, to include all scores
      timestamp.setHours(timestamp.getHours() - 1);

      const response = await endpoint
        .get(
          `/v1/leaderboard/${LEADERBOARD_ID}/scores/individual?sort=desc&limit=3&updatedAfter=${timestamp.toISOString()}`,
        )
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 500, publicIndividualName: "E" },
        { score: 400, publicIndividualName: "D" },
        { score: 300, publicIndividualName: "C" },
      ]);
    });

    it("should not return too old scores", async () => {
      const timestamp = new Date();
      // Set to the future to exclude all scores
      timestamp.setHours(timestamp.getHours() + 1);

      const response = await endpoint
        .get(
          `/v1/leaderboard/${LEADERBOARD_ID}/scores/individual?sort=desc&limit=3&updatedAfter=${timestamp.toISOString()}`,
        )
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([]);
    });

    it("should return individual scores (in reverse order)", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/individual?sort=asc`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 100, publicIndividualName: "A" },
        { score: 200, publicIndividualName: "B" },
        { score: 300, publicIndividualName: "C" },
        { score: 400, publicIndividualName: "D" },
        { score: 500, publicIndividualName: "E" },
      ]);
    });

    it("should return group scores", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/groups`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 500, publicGroupName: "GRP-B" },
        { score: 400, publicGroupName: "GRP-B" },
        { score: 300, publicGroupName: "GRP-B" },
        { score: 200, publicGroupName: "GRP-A" },
        { score: 100, publicGroupName: "GRP-A" },
      ]);
    });

    it("should return group scores (in reverse order)", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/groups?sort=asc`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 100, publicGroupName: "GRP-A" },
        { score: 200, publicGroupName: "GRP-A" },
        { score: 300, publicGroupName: "GRP-B" },
        { score: 400, publicGroupName: "GRP-B" },
        { score: 500, publicGroupName: "GRP-B" },
      ]);
    });

    it("should aggregate group scores", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/groups?aggregate=sum`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 1200, publicGroupName: "GRP-B" },
        { score: 300, publicGroupName: "GRP-A" },
      ]);
    });

    it("should aggregate group scores (in reverse order)", async () => {
      const response = await endpoint
        .get(
          `/v1/leaderboard/${LEADERBOARD_ID}/scores/groups?aggregate=sum&sort=asc`,
        )
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 300, publicGroupName: "GRP-A" },
        { score: 1200, publicGroupName: "GRP-B" },
      ]);
    });

    it("should aggregate group scores (in reverse order, with a limit)", async () => {
      const response = await endpoint
        .get(
          `/v1/leaderboard/${LEADERBOARD_ID}/scores/groups?aggregate=sum&sort=asc&limit=1`,
        )
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 300, publicGroupName: "GRP-A" },
      ]);
    });

    it("should (explicitly) not aggregate group scores", async () => {
      const response = await endpoint
        .get(`/v1/leaderboard/${LEADERBOARD_ID}/scores/groups?aggregate=none`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.scores).toMatchObject([
        { score: 500, publicGroupName: "GRP-B" },
        { score: 400, publicGroupName: "GRP-B" },
        { score: 300, publicGroupName: "GRP-B" },
        { score: 200, publicGroupName: "GRP-A" },
        { score: 100, publicGroupName: "GRP-A" },
      ]);
    });
  });
});
