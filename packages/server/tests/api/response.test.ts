import sequelize from "../../src/db/index.js";
import {
  NON_EXISTENT_UUID,
  api,
  createSession,
  useTestDatabase,
} from "../helpers/index.js";

beforeAll(useTestDatabase);

describe("POST /response", () => {
  it("should submit a response", async () => {
    const sessionId = await createSession();

    const response = await api.post("/v1/response").send({
      sessionId,
      name: "test_trial",
      payload: { key_1: "value 1", key_2: "value 2" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("responseId");

    const savedResponse = await sequelize.models.Response.findOne({
      where: { responseId: response.body.responseId },
    });
    expect(savedResponse).toHaveProperty("sessionId", sessionId);
    expect(savedResponse).toHaveProperty("name", "test_trial");
    expect(savedResponse).toHaveProperty("payload", {
      key_1: "value 1",
      key_2: "value 2",
    });
  });

  it("should submit a response without a payload", async () => {
    const sessionId = await createSession();

    const response = await api.post("/v1/response").send({ sessionId });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("responseId");
  });

  it("should fail to submit a response when the session does not exist", async () => {
    const response = await api.post("/v1/response").send({
      sessionId: NON_EXISTENT_UUID,
      name: "test_trial",
      payload: { key_1: "value 1" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown sessionId",
      type: "AppError",
    });
  });

  it("should fail to submit a response when the sessionId is invalid", async () => {
    const response = await api.post("/v1/response").send({
      sessionId: "non-existent-session-id",
      name: "test_trial",
      payload: { key_1: "value 1" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "sessionId must be a valid UUID",
      type: "ValidationError",
    });
  });

  it("should fail to submit non-JSON payload", async () => {
    const sessionId = await createSession();

    const response = await api.post("/v1/response").send({
      sessionId,
      name: "test_trial",
      payload: "this-is-not-json",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        'payload must be a `object` type, but the final value was: `"this-is-not-json"`.',
      type: "ValidationError",
    });
  });
});
