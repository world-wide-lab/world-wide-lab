// Set up fake environment variables
import "./setup_env";

import request from "supertest";
import app from "../src/app";
import sequelize from "../src/db";

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
        .put("/v1/participant/" + participantId)
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
        .put("/v1/participant/" + NON_EXISTENT_UUID)
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
        .get("/v1/participant/" + participantId)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.participantId).toBe(participantId);
      delete response.body.participantId;
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the participant does not exist", async () => {
      const response = await endpoint
        .get("/v1/participant/" + NON_EXISTENT_UUID)
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
        studyId: STUDY_ID + "_extra",
        privateInfo: { integer: 10 },
        publicInfo: { string: "lorem" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("studyId");
    });

    it("should validate extra info", async () => {
      const response = await endpoint
        .post("/v1/study")
        .send({ studyId: STUDY_ID + "_extra", privateInfo: 10 });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("POST /session", () => {
    it("should start a new session", async () => {
      const response = await endpoint
        .post("/v1/session")
        .send({ participantId, studyId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("participantId", participantId);
      expect(response.body).toHaveProperty("studyId", studyId);

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
      expect(response.body).toHaveProperty("participantId", participantId);
      expect(response.body).toHaveProperty("studyId", studyId);
      expect(response.body).toHaveProperty("sessionId");

      const session = await sequelize.models.Session.findOne({
        where: { sessionId: response.body.sessionId },
      });
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
      expect(response.body).toHaveProperty("studyId", studyId);
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
      const response = await endpoint.put("/v1/session/" + sessionId).send({
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
        .put("/v1/session/" + NON_EXISTENT_UUID)
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
      const response = await endpoint.get("/v1/session/" + sessionId).send();

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe(sessionId);
      delete response.body.sessionId;
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the session does not exist", async () => {
      const response = await endpoint
        .get("/v1/session/" + NON_EXISTENT_UUID)
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
      jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await endpoint
        .get(`/v1/study/${studyId}/count/non-existent-type`)
        .send();

      expect(response.status).toBe(500);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the study does not exist", async () => {
      const response = await endpoint
        .get(`/v1/study/non-existent-study/count/all`)
        .send();

      expect(response.status).toBe(400);
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
        .set("Authorization", `Bearer wrong-key`)
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the study does not exist", async () => {
      const response = await endpoint
        .get(`/v1/study/non-existent-study/data/participants-raw/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });
});
