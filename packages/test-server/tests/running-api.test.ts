import request from "supertest";

import "./setup_env";

const STUDY_ID_PREFIX = `test_${Date.now()}`;
const STUDY_ID = `${STUDY_ID_PREFIX}_default`;
const API_KEY = process.env.DEFAULT_API_KEY;
if (API_KEY === undefined) {
  throw new Error("DEFAULT_API_KEY must not be empty");
}

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

// Set up endpoint
let endpoint: request.SuperTest<request.Test>;
if (process.env.WWL_SERVER_URL === undefined) {
  console.log("WWL_SERVER_URL is undefined, starting a new server.");

  // Variable is of type Server, but it's a dynamic import
  let server: any;
  beforeAll(async () => {
    const { init } = await import("@world-wide-lab/server/src/init.ts");
    server = await init();

    // @ts-ignore - We know that the server will only be returned after listen() is finished
    endpoint = request(`http://localhost:${server.address().port}`);
  }, 10000);
  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(undefined);
        }
      });
    });
  }, 10000);
} else {
  console.log(`Running with an existing server: ${process.env.WWL_SERVER_URL}`);
  // Use a running endpoint
  endpoint = request(process.env.WWL_SERVER_URL);
}

describe("API Routes", () => {
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

    it("missing studyId should lead to an error", async () => {
      const response = await endpoint
        .post("/v1/session")
        .send({ participantId });

      expect(response.status).toBe(400);
    });
    it("missing participantId should be ok", async () => {
      const response = await endpoint.post("/v1/session").send({ studyId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("sessionId");
    });
  });

  describe("POST /session/finish", () => {
    it("should mark a session as finished", async () => {
      const response = await endpoint
        .post("/v1/session/finish")
        .send({ sessionId: sessionId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();
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
      expect(response.body.count).toBe(3);
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
  });

  describe("GET /study/:studyId/data/:dataType", () => {
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
      expect(response.body.length).toBe(3);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download a raw list of participant", async () => {
      const response = await endpoint
        .get(`/v1/study/${studyId}/data/participants-raw/json`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
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
      const lines = response.text
        // Separate lines
        .split(/\r\n|\r|\n/)
        // Only keep non-empty lines
        .filter((l) => l !== "");
      expect(lines.length).toBe(4 + 1);
      expect(lines[0]).toMatchSnapshot();
    });

    it("should handle empty studies as well", async () => {
      const studyIdEmpty = `${STUDY_ID_PREFIX}_empty-study`;
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
      const studyIdEmpty = `${STUDY_ID_PREFIX}_empty-study-2`;
      // Create new empty study
      await endpoint.post("/v1/study").send({ studyId: studyIdEmpty });

      const response = await endpoint
        .get(`/v1/study/${studyIdEmpty}/data/responses-extracted-payload/csv`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(
        // Empty string when using default export
        response.text === "" ||
          // Only column names when exporting directly from PostgreSQL
          response.text === "responseId,createdAt,updatedAt,name,sessionId\n",
      ).toBeTruthy();
    });

    it("should handle studies without payload as well", async () => {
      const studyIdNoPayload = `${STUDY_ID_PREFIX}_no-payload-study`;
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
});
