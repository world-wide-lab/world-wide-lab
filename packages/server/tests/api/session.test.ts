import { version } from "../../package.json";
import sequelize from "../../src/db/index.js";
import {
  NON_EXISTENT_UUID,
  api,
  createParticipant,
  createSession,
  createStudy,
  useTestDatabase,
} from "../helpers/index.js";

beforeAll(useTestDatabase);

describe("POST /session", () => {
  it("should start a new session", async () => {
    const studyId = await createStudy();
    const participantId = await createParticipant();

    const response = await api.post("/v1/session").send({
      participantId,
      studyId,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("sessionId");

    const session = await sequelize.models.Session.findOne({
      where: { sessionId: response.body.sessionId },
    });
    expect(session).toHaveProperty("studyId", studyId);
    expect(session).toHaveProperty("participantId", participantId);
    expect(session).toHaveProperty("finished", false);
  });

  it("should start a new session with extra info", async () => {
    const studyId = await createStudy();
    const participantId = await createParticipant();

    const response = await api.post("/v1/session").send({
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
    expect(session).toHaveProperty("privateInfo", { integer: 10 });
    expect(session).toHaveProperty("publicInfo", { string: "lorem" });
    expect(session?.getDataValue("metadata")).toEqual({
      wwl_version: version,
      client: { version: "1.0", queryParameters: { test: "test" } },
    });
  });

  it("missing studyId should lead to an error", async () => {
    const participantId = await createParticipant();

    const response = await api.post("/v1/session").send({ participantId });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "studyId is a required field",
      type: "ValidationError",
    });
  });

  it("missing participantId should be ok", async () => {
    const studyId = await createStudy();

    const response = await api.post("/v1/session").send({ studyId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("sessionId");
  });

  it("should validate extra info", async () => {
    const studyId = await createStudy();

    const response = await api
      .post("/v1/session")
      .send({ studyId, privateInfo: 10 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        "privateInfo must be a `object` type, but the final value was: `10`.",
      type: "ValidationError",
    });
  });
});

describe("POST /session/finish", () => {
  it("should mark a session as finished", async () => {
    const sessionId = await createSession();

    const response = await api.post("/v1/session/finish").send({ sessionId });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    const session = await sequelize.models.Session.findOne({
      where: { sessionId },
    });
    expect(session).toHaveProperty("finished", true);
  });

  it("should fail when the session does not exist", async () => {
    const response = await api
      .post("/v1/session/finish")
      .send({ sessionId: NON_EXISTENT_UUID });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown sessionId",
      type: "AppError",
    });
  });

  it("should fail when the sessionId is invalid", async () => {
    const response = await api
      .post("/v1/session/finish")
      .send({ sessionId: "non-existent" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "sessionId must be a valid UUID",
      type: "ValidationError",
    });
  });
});

describe("PUT /session/:sessionId", () => {
  it("should update a session", async () => {
    const sessionId = await createSession();

    const response = await api.put(`/v1/session/${sessionId}`).send({
      privateInfo: { lorem: "ipsum" },
      publicInfo: { dolor: "sit" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    const session = await sequelize.models.Session.findOne({
      where: { sessionId },
    });
    expect(session).toHaveProperty("privateInfo", { lorem: "ipsum" });
    expect(session).toHaveProperty("publicInfo", { dolor: "sit" });
  });

  it("should fail when the session does not exist", async () => {
    const response = await api
      .put(`/v1/session/${NON_EXISTENT_UUID}`)
      .send({ privateInfo: { lorem: "ipsum" } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown sessionId",
      type: "AppError",
    });
  });

  it("should fail when the sessionId is invalid", async () => {
    const response = await api
      .put("/v1/session/non-existent-session-id")
      .send({ privateInfo: { lorem: "ipsum" } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "sessionId must be a valid UUID",
      type: "ValidationError",
    });
  });
});

describe("GET /session/:sessionId", () => {
  it("should only return public information about a session", async () => {
    const sessionId = await createSession({
      privateInfo: { lorem: "ipsum" },
      publicInfo: { dolor: "sit" },
    });

    const response = await api.get(`/v1/session/${sessionId}`).send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sessionId,
      publicInfo: { dolor: "sit" },
    });
  });

  it("should fail when the session does not exist", async () => {
    const response = await api.get(`/v1/session/${NON_EXISTENT_UUID}`).send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown sessionId",
      type: "AppError",
    });
  });

  it("should fail when the sessionId is invalid", async () => {
    const response = await api
      .get("/v1/session/non-existent-session-id")
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "sessionId must be a valid UUID",
      type: "ValidationError",
    });
  });
});
