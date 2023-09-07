// Set up fake environment variables
import "./setup_env";

import request from "supertest";
import sequelize from "../src/db";
import app from "../src/app";

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
  let runId: string;
  let studyId: string = STUDY_ID;

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
  });

  describe("POST /run", () => {
    it("should start a new run", async () => {
      const response = await endpoint
        .post("/v1/run")
        .send({ participantId, studyId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("participantId", participantId);
      expect(response.body).toHaveProperty("studyId", studyId);

      // Set the shared runId
      runId = response.body.runId;
    });

    it("missing studyId should lead to an error", async () => {
      const response = await endpoint.post("/v1/run").send({ participantId });

      expect(response.status).toBe(400);
    });
    it("missing participantId should be ok", async () => {
      const response = await endpoint.post("/v1/run").send({ studyId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("studyId", studyId);
      expect(response.body).toHaveProperty("runId");
    });
  });

  describe("POST /run/finish", () => {
    it("should mark a run as finished", async () => {
      const response = await endpoint
        .post("/v1/run/finish")
        .send({ runId: runId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const run = await sequelize.models.Run.findOne({
        where: { runId },
      });
      expect(run).toHaveProperty("finished", true);
    });

    it("should fail when the run does not exist", async () => {
      const response = await endpoint
        .post("/v1/run/finish")
        .send({ runId: NON_EXISTENT_UUID });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the runId is invalid", async () => {
      const response = await endpoint
        .post("/v1/run/finish")
        .send({ runId: "non-existent" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("PUT /run/:runId", () => {
    it("should update a run", async () => {
      const response = await endpoint.put("/v1/run/" + runId).send({
        privateInfo: { lorem: "ipsum" },
        publicInfo: { dolor: "sit" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const run = await sequelize.models.Run.findOne({
        where: { runId },
      });
      expect(run).toHaveProperty("privateInfo", { lorem: "ipsum" });
      expect(run).toHaveProperty("publicInfo", { dolor: "sit" });
    });

    it("should fail when the run does not exist", async () => {
      const response = await endpoint
        .put("/v1/run/" + NON_EXISTENT_UUID)
        .send({ privateInfo: { lorem: "ipsum" } });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the runId is invalid", async () => {
      const response = await endpoint
        .put("/v1/run/" + "non-existent-run-id")
        .send({ privateInfo: { lorem: "ipsum" } });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("GET /run/:runId", () => {
    it("should retrieve public information about a run", async () => {
      const response = await endpoint.get("/v1/run/" + runId).send();

      expect(response.status).toBe(200);
      expect(response.body.runId).toBe(runId);
      delete response.body.runId;
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the run does not exist", async () => {
      const response = await endpoint
        .get("/v1/run/" + NON_EXISTENT_UUID)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the runId is invalid", async () => {
      const response = await endpoint
        .get("/v1/run/" + "non-existent-run-id")
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("POST /response", () => {
    it("should submit a response", async () => {
      const response = await endpoint.post("/v1/response").send({
        runId,
        name: "test_trail",
        payload: {
          key_1: "value 1",
          key_2: "value 2",
        },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("responseId");
      const { responseId } = response.body;

      const runResponse = await sequelize.models.Response.findOne({
        where: { responseId },
      });
      expect(runResponse).toHaveProperty("runId", runId);
      expect(runResponse).toHaveProperty("name", "test_trail");
      expect(runResponse).toHaveProperty("payload", {
        key_1: "value 1",
        key_2: "value 2",
      });
    });

    it("should fail to submit a response when the run does not exist", async () => {
      const response = await endpoint.post("/v1/response").send({
        runId: NON_EXISTENT_UUID,
        name: "test_trail",
        payload: {
          key_1: "value 1",
          key_2: "value 2",
        },
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail to submit a response when the runId is invalid", async () => {
      const response = await endpoint.post("/v1/response").send({
        runId: "non-existent-run-id",
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
        runId,
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
      // Two more responses for first run
      await endpoint.post("/v1/response").send({ runId, ...exampleData });
      await endpoint.post("/v1/response").send({ runId, ...exampleData });
      // And one additional responses in a new run
      const newRunResponse = await endpoint
        .post("/v1/run")
        .send({ participantId, studyId });
      await endpoint
        .post("/v1/response")
        .send({ runId: newRunResponse.body.runId, ...exampleData });
    });
  });

  describe("GET /study/:studyId/count/:countType", () => {
    it("should return the correct count (for all runs)", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/count/all`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);
    });

    it("should return the correct count (for only finished runs)", async () => {
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

  describe("GET /study/:studyId/data/:dataType", () => {
    it("should download a raw list of responses", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/responses-raw`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(4);
      expect(Object.keys(response.body[0])).toMatchInlineSnapshot(`
        [
          "responseId",
          "createdAt",
          "updatedAt",
          "name",
          "payload",
          "runId",
          "Run.participantId",
        ]
      `);
    });

    it("should download a raw list of runs", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/runs-raw`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(3);
      expect(Object.keys(response.body[0])).toMatchInlineSnapshot(`
        [
          "runId",
          "createdAt",
          "updatedAt",
          "privateInfo",
          "publicInfo",
          "finished",
          "participantId",
          "studyId",
        ]
      `);
    });

    it("should download a raw list of participant", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(Object.keys(response.body[0])).toMatchInlineSnapshot(`
        [
          "participantId",
          "createdAt",
          "updatedAt",
          "privateInfo",
          "publicInfo",
          "Runs.runId",
        ]
      `);
    });

    it("should download an extracted list of responses", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/responses-extracted-payload`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(4);
      expect(Object.keys(response.body[0])).toMatchInlineSnapshot(`
        [
          "responseId",
          "createdAt",
          "updatedAt",
          "name",
          "runId",
          "key_1",
          "key_2",
        ]
      `);
      expect(response.body[0].key_1).toBe("value 1");
      expect(response.body[3].key_2).toBe("value 2");
    });

    it("should handle empty studies as well", async () => {
      const studyIdEmpty = "empty-study";
      // Create new empty study
      await endpoint.post("/v1/study").send({ studyId: studyIdEmpty });

      const response = await endpoint
        .get(`/v1/study/${studyIdEmpty}/data/responses-extracted-payload`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });

    it("should handle studies without payload as well", async () => {
      const studyIdNoPayload = "no-payload-study";
      // Create new empty study and add one run with one response
      await endpoint.post("/v1/study").send({ studyId: studyIdNoPayload });
      const runResponse = await endpoint
        .post("/v1/run")
        .send({ participantId, studyId: studyIdNoPayload });
      await endpoint
        .post("/v1/response")
        .send({ runId: runResponse.body.runId });

      const response = await endpoint
        .get(`/v1/study/${studyIdNoPayload}/data/responses-extracted-payload`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(Object.keys(response.body[0])).toMatchInlineSnapshot(`
        [
          "responseId",
          "createdAt",
          "updatedAt",
          "name",
          "runId",
        ]
      `);
    });

    it("should require authentication", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw`)
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it("should require the correct API KEY", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw`)
        .set("Authorization", `Bearer wrong-key`)
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when the study does not exist", async () => {
      const response = await endpoint
        .get(`/v1/study/non-existent-study/data/participants-raw`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toMatchSnapshot();
    });
  });
});
