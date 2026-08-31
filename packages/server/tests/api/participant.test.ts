import sequelize from "../../src/db/index.js";
import {
  NON_EXISTENT_UUID,
  api,
  createParticipant,
  useTestDatabase,
} from "../helpers/index.js";

beforeAll(useTestDatabase);

describe("POST /participant", () => {
  it("should create a new participant", async () => {
    const response = await api.post("/v1/participant").send();

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("participantId");
  });
});

describe("PUT /participant/:participantId", () => {
  it("should update an existing participant", async () => {
    const participantId = await createParticipant();

    const response = await api.put(`/v1/participant/${participantId}`).send({
      privateInfo: { lorem: "ipsum" },
      publicInfo: { participantHasDoneSomething: true },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });

    const participant = await sequelize.models.Participant.findOne({
      where: { participantId },
    });
    expect(participant).toHaveProperty("privateInfo", { lorem: "ipsum" });
    expect(participant).toHaveProperty("publicInfo", {
      participantHasDoneSomething: true,
    });
  });

  it("should fail when the participant does not exist", async () => {
    const response = await api
      .put(`/v1/participant/${NON_EXISTENT_UUID}`)
      .send({ privateInfo: { lorem: "ipsum" } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown participantId",
      type: "AppError",
    });
  });

  it("should fail when the participant is invalid", async () => {
    const response = await api
      .put("/v1/participant/some-non-existing-ID")
      .send({ privateInfo: { lorem: "ipsum" } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "participantId must be a valid UUID",
      type: "ValidationError",
    });
  });
});

describe("GET /participant/:participantId", () => {
  it("should only return public information about a participant", async () => {
    const participantId = await createParticipant({
      privateInfo: { lorem: "ipsum" },
      publicInfo: { participantHasDoneSomething: true },
    });

    const response = await api.get(`/v1/participant/${participantId}`).send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      participantId,
      publicInfo: { participantHasDoneSomething: true },
    });
  });

  it("should fail when the participant does not exist", async () => {
    const response = await api
      .get(`/v1/participant/${NON_EXISTENT_UUID}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown participantId",
      type: "AppError",
    });
  });

  it("should fail when the participant is invalid", async () => {
    const response = await api
      .get("/v1/participant/non-existent-participant-id")
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "participantId must be a valid UUID",
      type: "ValidationError",
    });
  });
});
