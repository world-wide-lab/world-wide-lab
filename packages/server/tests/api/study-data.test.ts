import {
  NON_EXISTENT_STUDY_ID,
  api,
  authed,
  createResponse,
  createSession,
  createStudy,
  seedStudy,
  useTestDatabase,
} from "../helpers/index.js";
import type { StudyScenario } from "../helpers/index.js";

beforeAll(useTestDatabase);

// A study with 4 sessions, 4 responses and 1 (shared) participant.
async function seedStudyWithData(): Promise<StudyScenario> {
  return await seedStudy({
    sessions: [
      { finished: true, responses: 3 },
      { responses: 1 },
      { responses: 0 },
      { responses: 0 },
    ],
  });
}

function hoursFromNow(hours: number): string {
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() + hours);
  return timestamp.toISOString();
}

const dataUrl = (studyId: string, dataType: string, format = "json") =>
  `/v1/study/${studyId}/data/${dataType}/${format}`;

describe("GET /study/:studyId/data/:dataType/:format", () => {
  // The exact set of columns is part of the download contract, so it is worth
  // pinning down. Everything else is asserted explicitly.
  it.each([
    {
      dataType: "responses-raw",
      expectedRows: 4,
      expectedColumns: [
        "responseId",
        "createdAt",
        "updatedAt",
        "name",
        "payload",
        "sessionId",
        "Session.participantId",
      ],
    },
    {
      dataType: "sessions-raw",
      expectedRows: 4,
      expectedColumns: [
        "sessionId",
        "createdAt",
        "updatedAt",
        "privateInfo",
        "publicInfo",
        "finished",
        "participantId",
        "studyId",
        "metadata",
      ],
    },
    {
      dataType: "participants-raw",
      expectedRows: 1,
      expectedColumns: [
        "participantId",
        "createdAt",
        "updatedAt",
        "privateInfo",
        "publicInfo",
      ],
    },
    {
      dataType: "responses-extracted-payload",
      expectedRows: 4,
      expectedColumns: [
        "responseId",
        "createdAt",
        "updatedAt",
        "name",
        "sessionId",
        "key_1",
        "key_2",
      ],
    },
  ])(
    "should download $dataType as JSON",
    async ({ dataType, expectedRows, expectedColumns }) => {
      const { studyId } = await seedStudyWithData();

      const response = await authed(api.get(dataUrl(studyId, dataType)));

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(expectedRows);
      expect(Object.keys(response.body[0])).toEqual(expectedColumns);
    },
  );

  it("should extract the payload of each response into its own column", async () => {
    const { studyId } = await seedStudyWithData();

    const response = await authed(
      api.get(dataUrl(studyId, "responses-extracted-payload")),
    );

    expect(response.status).toBe(200);
    for (const row of response.body) {
      expect(row.key_1).toBe("value 1");
      expect(row.key_2).toBe("value 2");
    }
  });

  it("should download an extracted list of responses (in CSV format)", async () => {
    const { studyId } = await seedStudyWithData();

    const response = await authed(
      api.get(dataUrl(studyId, "responses-extracted-payload", "csv")),
    );

    expect(response.status).toBe(200);
    const lines = response.text.split(/\r\n|\r|\n/);
    expect(lines[0]).toBe(
      "responseId,createdAt,updatedAt,name,sessionId,key_1,key_2",
    );
    // One header row plus one row per response
    expect(lines.length).toBe(1 + 4);
  });

  it("should handle empty studies as well", async () => {
    const studyId = await createStudy();

    const response = await authed(
      api.get(dataUrl(studyId, "responses-extracted-payload")),
    );

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(0);
  });

  it("should handle empty studies as well (in CSV format)", async () => {
    const studyId = await createStudy();

    const response = await authed(
      api.get(dataUrl(studyId, "responses-extracted-payload", "csv")),
    );

    expect(response.status).toBe(200);
    expect(response.text).toBe("");
  });

  it("should handle studies without payload as well", async () => {
    const studyId = await createStudy();
    const sessionId = await createSession({ studyId });
    await createResponse({ sessionId, payload: null });

    const response = await authed(
      api.get(dataUrl(studyId, "responses-extracted-payload")),
    );

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(Object.keys(response.body[0])).toEqual([
      "responseId",
      "createdAt",
      "updatedAt",
      "name",
      "sessionId",
    ]);
  });

  it("should require authentication", async () => {
    const studyId = await createStudy();

    const response = await api.get(dataUrl(studyId, "participants-raw")).send();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Authentication via API Key required",
    });
  });

  it("should require the correct API KEY", async () => {
    const studyId = await createStudy();

    const response = await api
      .get(dataUrl(studyId, "participants-raw"))
      .set("Authorization", "Bearer wrong-key")
      .send();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "The provided API Key is invalid.",
    });
  });

  it("should fail when the study does not exist", async () => {
    const response = await authed(
      api.get(dataUrl(NON_EXISTENT_STUDY_ID, "participants-raw")),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Unknown studyId" });
  });
});

describe("GET /study/:studyId/data/:dataType/:format?created_after=", () => {
  it.each([
    { dataType: "responses-raw", expectedRows: 4 },
    { dataType: "sessions-raw", expectedRows: 4 },
    { dataType: "participants-raw", expectedRows: 1 },
    { dataType: "responses-extracted-payload", expectedRows: 4 },
  ])(
    "should include all $dataType created after a past timestamp",
    async ({ dataType, expectedRows }) => {
      const { studyId } = await seedStudyWithData();

      const response = await authed(
        api.get(
          `${dataUrl(studyId, dataType)}?created_after=${hoursFromNow(-1)}`,
        ),
      );

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(expectedRows);
    },
  );

  it.each([
    "responses-raw",
    "sessions-raw",
    "participants-raw",
    "responses-extracted-payload",
  ])(
    "should exclude all %s created after a future timestamp",
    async (dataType) => {
      const { studyId } = await seedStudyWithData();

      const response = await authed(
        api.get(
          `${dataUrl(studyId, dataType)}?created_after=${hoursFromNow(1)}`,
        ),
      );

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    },
  );

  it("should also filter CSV downloads", async () => {
    const { studyId } = await seedStudyWithData();
    const url = dataUrl(studyId, "responses-extracted-payload", "csv");

    const included = await authed(
      api.get(`${url}?created_after=${hoursFromNow(-12)}`),
    );
    expect(included.status).toBe(200);
    expect(included.text.split(/\r\n|\r|\n/).length).toBe(1 + 4);

    const excluded = await authed(
      api.get(`${url}?created_after=${hoursFromNow(1)}`),
    );
    expect(excluded.status).toBe(200);
    expect(excluded.text).toBe("");
  });

  it("should accept a plain date string", async () => {
    const { studyId } = await seedStudyWithData();
    const url = dataUrl(studyId, "responses-raw");

    const today = new Date().toISOString().split("T")[0];
    const included = await authed(api.get(`${url}?created_after=${today}`));
    expect(included.status).toBe(200);
    expect(included.body.length).toBe(4);

    const tomorrow = hoursFromNow(24).split("T")[0];
    const excluded = await authed(api.get(`${url}?created_after=${tomorrow}`));
    expect(excluded.status).toBe(200);
    expect(excluded.body.length).toBe(0);
  });

  it("should reject an invalid date format", async () => {
    const studyId = await createStudy();

    const response = await authed(
      api.get(
        `${dataUrl(studyId, "responses-raw")}?created_after=invalid-date`,
      ),
    );

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});
