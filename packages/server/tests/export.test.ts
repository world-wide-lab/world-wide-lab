// Set up fake environment variables
import "./setup_env";

import request from "supertest";
import app from "../src/app";
import config from "../src/config";
import sequelize from "../src/db";

const endpoint = request(app);

const API_KEY = process.env.DEFAULT_API_KEY;

const STUDY_ID = "chunked-export";
// Study whose payloads contain keys that clash with the response's own columns
const STUDY_ID_CLASHING_KEYS = "chunked-export-clashing-keys";

const N_PARTICIPANTS = 3;
const N_SESSIONS_PER_PARTICIPANT = 2;
const N_RESPONSES_PER_SESSION = 5;

const N_SESSIONS = N_PARTICIPANTS * N_SESSIONS_PER_PARTICIPANT;
const N_RESPONSES = N_SESSIONS * N_RESPONSES_PER_SESSION;

const defaultChunkSize = config.database.chunkSize;

// Create a study with a fixed number of participants, sessions and responses
async function generateStudyData(
  studyId: string,
  payloadFor: (index: number) => object,
) {
  await sequelize.models.Study.create({ studyId });

  let responseIndex = 0;
  for (let p = 0; p < N_PARTICIPANTS; p++) {
    const participant: any = await sequelize.models.Participant.create({});

    for (let s = 0; s < N_SESSIONS_PER_PARTICIPANT; s++) {
      const session: any = await sequelize.models.Session.create({
        studyId,
        participantId: participant.participantId,
      });

      for (let r = 0; r < N_RESPONSES_PER_SESSION; r++) {
        await sequelize.models.Response.create({
          sessionId: session.sessionId,
          name: `trial_${r}`,
          payload: payloadFor(responseIndex),
        });
        responseIndex++;
      }
    }
  }
}

function download(studyId: string, dataType: string, format: string) {
  return endpoint
    .get(`/v1/study/${studyId}/data/${dataType}/${format}`)
    .set("Authorization", `Bearer ${API_KEY}`)
    .send();
}

function uniqueValues(rows: object[], key: string) {
  return new Set(rows.map((row) => (row as Record<string, unknown>)[key]));
}

// Split a CSV export into lines, ignoring a trailing newline (postgres' COPY
// terminates its last row with one, json-2-csv does not).
function csvLines(text: string) {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

describe("Chunked data exports", () => {
  beforeAll(async () => {
    await sequelize.sync();

    await generateStudyData(STUDY_ID, (index) => ({
      index,
      key_1: `value ${index}`,
    }));
    await generateStudyData(STUDY_ID_CLASHING_KEYS, (index) => ({
      // These keys are also columns of wwl_responses, so they end up being
      // selected twice in the extracted-payload export
      responseId: `payload-value-${index}`,
      name: `payload-name-${index}`,
    }));
  });

  afterEach(() => {
    config.database.chunkSize = defaultChunkSize;
  });

  // Chunk sizes that divide the number of responses evenly and ones that don't,
  // plus one that is larger than the data itself.
  describe.each([1, 4, 7, 10, 30, 100])(
    "with a chunk size of %i",
    (chunkSize) => {
      it("should export every response exactly once (responses-raw)", async () => {
        config.database.chunkSize = chunkSize;

        const response = await download(STUDY_ID, "responses-raw", "json");

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(N_RESPONSES);
        expect(uniqueValues(response.body, "responseId").size).toBe(
          N_RESPONSES,
        );

        // Keyset pagination relies on a stable, ascending order
        const responseIds = response.body.map((row: any) => row.responseId);
        expect(responseIds).toEqual([...responseIds].sort((a, b) => a - b));
      });

      it("should export every session exactly once (sessions-raw)", async () => {
        config.database.chunkSize = chunkSize;

        const response = await download(STUDY_ID, "sessions-raw", "json");

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(N_SESSIONS);
        expect(uniqueValues(response.body, "sessionId").size).toBe(N_SESSIONS);
      });

      it("should export every participant exactly once (participants-raw)", async () => {
        config.database.chunkSize = chunkSize;

        const response = await download(STUDY_ID, "participants-raw", "json");

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(N_PARTICIPANTS);
        expect(uniqueValues(response.body, "participantId").size).toBe(
          N_PARTICIPANTS,
        );
      });

      it("should export every response exactly once (responses-extracted-payload)", async () => {
        config.database.chunkSize = chunkSize;

        const response = await download(
          STUDY_ID,
          "responses-extracted-payload",
          "json",
        );

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(N_RESPONSES);
        expect(uniqueValues(response.body, "responseId").size).toBe(
          N_RESPONSES,
        );

        // The payload should have been extracted into its own columns
        expect(uniqueValues(response.body, "key_1").size).toBe(N_RESPONSES);
      });

      it("should export every response exactly once (responses-extracted-payload, CSV)", async () => {
        config.database.chunkSize = chunkSize;

        const response = await download(
          STUDY_ID,
          "responses-extracted-payload",
          "csv",
        );

        expect(response.status).toBe(200);
        const lines = csvLines(response.text);
        // One header line, followed by one line per response
        expect(lines.length).toBe(N_RESPONSES + 1);

        // The header should only be written once, for the very first chunk
        const header = lines[0];
        expect(lines.slice(1).filter((line) => line === header).length).toBe(0);
      });
    },
  );

  describe("internal cursor column", () => {
    it("should not leak into the exported data", async () => {
      config.database.chunkSize = 4;

      const response = await download(
        STUDY_ID,
        "responses-extracted-payload",
        "json",
      );

      expect(response.status).toBe(200);
      for (const row of response.body) {
        expect(Object.keys(row)).not.toContain("__wwl_keyset_cursor");
      }
    });

    it("should not leak into the exported data (CSV)", async () => {
      config.database.chunkSize = 4;

      const response = await download(
        STUDY_ID,
        "responses-extracted-payload",
        "csv",
      );

      expect(response.status).toBe(200);
      expect(response.text).not.toContain("__wwl_keyset_cursor");
    });

    it("should not be affected by payload keys clashing with table columns", async () => {
      config.database.chunkSize = 4;

      const response = await download(
        STUDY_ID_CLASHING_KEYS,
        "responses-extracted-payload",
        "json",
      );

      expect(response.status).toBe(200);
      // Even though the payload shadows the responseId column, pagination
      // still has to walk through all responses exactly once
      expect(response.body.length).toBe(N_RESPONSES);
      expect(uniqueValues(response.body, "responseId").size).toBe(N_RESPONSES);
    });
  });

  describe("combined with created_after", () => {
    it("should still export all matching responses", async () => {
      config.database.chunkSize = 4;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const response = await endpoint
        .get(
          `/v1/study/${STUDY_ID}/data/responses-raw/json?created_after=${oneHourAgo}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(N_RESPONSES);
      expect(uniqueValues(response.body, "responseId").size).toBe(N_RESPONSES);
    });

    it("should return no responses when nothing matches", async () => {
      config.database.chunkSize = 4;
      const oneHourFromNow = new Date(
        Date.now() + 60 * 60 * 1000,
      ).toISOString();

      const response = await endpoint
        .get(
          `/v1/study/${STUDY_ID}/data/responses-raw/json?created_after=${oneHourFromNow}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });
  });
});
