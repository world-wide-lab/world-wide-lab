// Set up fake environment variables
import "./setup_env";

import { URL } from "url";
import { Op } from "sequelize";
import request from "supertest";
import app from "../src/app";
import config from "../src/config";
import sequelize from "../src/db";
import generateExampleData from "../src/db/exampleData";
import { up } from "../src/db/migrate";
import { UnknownTableError, findModelByTableName } from "../src/db/replication";

const endpoint = request(app);

const API_KEY = process.env.DEFAULT_API_KEY;

const updatedAfter = new Date("2000-01-01T00:00:00Z").toISOString();

describe("Replication", () => {
  beforeAll(async () => {
    // Initialize Database
    await up();
    await sequelize.sync();
  });

  describe("Setup (Example Data)", () => {
    it("should create example data", async () => {
      // Generate example data twice
      // TODO: Mock dates to allow for testing the function of updated_after
      await generateExampleData(sequelize);
      await generateExampleData(sequelize, "example2");

      const nStudies = await sequelize.models.Study.count();
      expect(nStudies).toBe(1 * 2);

      const nParticipants = await sequelize.models.Participant.count();
      expect(nParticipants).toBe(4 * 2);

      const nSessions = await sequelize.models.Session.count();
      expect(nSessions).toBe(8 * 2);

      const nResponses = await sequelize.models.Response.count();
      expect(nResponses).toBe(20 * 2);
    });
  });

  describe("Function: findModelByTableName", () => {
    it("should return the model for a valid table name", () => {
      const model = findModelByTableName("wwl_participants");
      expect(model).toBe(sequelize.models.Participant);
    });

    it("should throw an UnknownTableError for an invalid table name", () => {
      expect(() => findModelByTableName("invalidTable")).toThrow(
        UnknownTableError,
      );
    });
  });

  describe("API of Replication Source", () => {
    beforeAll(() => {
      config.replication.role = "source";
    });

    it("should download a raw list of studies", async () => {
      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_studies?limit=2&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should retrieve a list of participants", async () => {
      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_participants?limit=5&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(5);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download a raw list of sessions", async () => {
      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_sessions?limit=12&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(12);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download a raw list of sessions, honoring offsets", async () => {
      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_sessions?limit=12&offset=8&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(8);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should download a raw list of responses, honoring offsets, without updated_after", async () => {
      const response = await endpoint
        .get(
          "/v1/replication/source/get-table/wwl_responses?limit=25&offset=22",
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(18);
    });

    it("should download a raw list of responses, with multiple chunks", async () => {
      config.database.chunkSize = 2;
      const response = await endpoint
        .get("/v1/replication/source/get-table/wwl_responses?limit=25&offset=3")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(25);
    });

    it("should download a raw list of responses", async () => {
      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_responses?limit=32&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(32);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should support proper chunking of data", async () => {
      config.database.chunkSize = 2;

      const response = await endpoint
        .get("/v1/replication/source/get-table/wwl_responses?limit=6&offset=12")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(6);
      expect(Object.keys(response.body[0])).toMatchSnapshot();
    });

    it("should fail when not authenticated", async () => {
      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_studies?limit=2&updated_after=${updatedAfter}`,
        )
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when not configured to act as replication source", async () => {
      config.replication.role = "destination";

      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_studies?limit=2&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(418);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when not configured to act as replication source", async () => {
      config.replication.role = null;

      const response = await endpoint
        .get(
          `/v1/replication/source/get-table/wwl_responses?limit=32&updated_after=${updatedAfter}`,
        )
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(418);
      expect(response.body).toMatchSnapshot();
    });
  });

  describe("API of Replication Destination", () => {
    beforeAll(async () => {
      const REPLICATION_SOURCE_URL = "https://wwl-test";

      // Overwrite configuration
      config.replication.role = "destination";
      config.replication.source = REPLICATION_SOURCE_URL;
      config.replication.sourceApiKey = "non-existent-key";
      config.replication.chunkSize = 2;

      const infoRepsonse = await endpoint.get("/v1/info").send();
      const infoData = infoRepsonse.body;

      // Set up Mocks
      const MOCK_RESPONSES = {
        "/v1/info": {
          GET: () => {
            // Return own info object, so that it always matches the version
            return infoData;
          },
        },
        "/v1/replication/source/get-table/wwl_responses/?": {
          GET: [
            {
              responseId: 1,
              createdAt: "2024-02-13T22:16:56.539Z",
              updatedAt: "2024-02-13T22:16:56.539Z",
              name: "trial-1",
              payload: {
                response: "Response #1",
              },
              sessionId: "8c8facd9-050e-4643-abe5-ed563e8da70a",
            },
            {
              responseId: 2,
              createdAt: "2024-02-13T22:16:56.540Z",
              updatedAt: "2024-02-13T22:16:56.540Z",
              name: "trial-2",
              payload: {
                response: "Response #2",
              },
              sessionId: "8c8facd9-050e-4643-abe5-ed563e8da70a",
            },
            {
              responseId: 3,
              createdAt: "2024-02-13T22:16:56.540Z",
              updatedAt: "2024-02-13T22:16:56.540Z",
              name: "trial-3",
              payload: {
                response: "Response #3",
              },
              sessionId: "8c8facd9-050e-4643-abe5-ed563e8da70a",
            },
            {
              responseId: 4,
              createdAt: "2024-02-13T22:16:56.544Z",
              updatedAt: "2024-02-13T22:16:56.544Z",
              name: "trial-1",
              payload: {
                response: "Response #1",
              },
              sessionId: "d6533e79-ea6b-4b04-a142-946f5e861b43",
            },
            {
              responseId: 5,
              createdAt: "2024-02-13T22:16:56.544Z",
              updatedAt: "2024-02-13T22:16:56.544Z",
              name: "trial-2",
              payload: {
                response: "Response #2",
              },
              sessionId: "d6533e79-ea6b-4b04-a142-946f5e861b43",
            },
          ],
        },
        "/v1/replication/source/get-table/wwl_studies/?": {
          GET: [
            {
              studyId: "replication-test",
              createdAt: "2024-02-13T22:16:56.533Z",
              updatedAt: "2024-02-13T22:16:56.533Z",
              privateInfo: null,
              publicInfo: null,
              deletionProtection: true,
            },
          ],
        },
        "/v1/replication/source/get-table/wwl_participants/?": {
          GET: [
            {
              participantId: "38c10788-6062-43d3-a2e7-cfa929ddaf57",
              createdAt: "2024-02-09T22:16:56.536Z",
              updatedAt: "2024-02-13T22:16:56.536Z",
              privateInfo: {
                description: "Example User #1",
              },
              publicInfo: null,
            },
            {
              participantId: "6b5112d6-93ba-471f-9d76-7deec118ab89",
              createdAt: "2024-02-10T22:16:56.542Z",
              updatedAt: "2024-02-13T22:16:56.542Z",
              privateInfo: {
                description: "Example User #2",
              },
              publicInfo: null,
            },
          ],
        },
        "/v1/replication/source/get-table/wwl_sessions/?": {
          GET: [
            {
              sessionId: "8c8facd9-050e-4643-abe5-ed563e8da70a",
              createdAt: "2024-02-09T22:16:56.536Z",
              updatedAt: "2024-02-13T22:16:56.538Z",
              privateInfo: null,
              publicInfo: null,
              finished: true,
              participantId: "38c10788-6062-43d3-a2e7-cfa929ddaf57",
              studyId: "replication-test",
              metadata: null,
            },
            {
              sessionId: "d6533e79-ea6b-4b04-a142-946f5e861b43",
              createdAt: "2024-02-10T22:16:56.542Z",
              updatedAt: "2024-02-13T22:16:56.543Z",
              privateInfo: null,
              publicInfo: null,
              finished: true,
              participantId: "6b5112d6-93ba-471f-9d76-7deec118ab89",
              studyId: "replication-test",
              metadata: null,
            },
            {
              sessionId: "0ec73e4e-6aea-42cc-bfee-8f700bfa1bcd",
              createdAt: "2024-02-10T22:16:56.542Z",
              updatedAt: "2024-02-10T22:16:56.542Z",
              privateInfo: null,
              publicInfo: null,
              finished: true,
              participantId: "38c10788-6062-43d3-a2e7-cfa929ddaf57",
              studyId: "replication-test",
              metadata: null,
            },
            {
              sessionId: "be218a6f-b3f7-4b01-84e0-c26a8782dd0b",
              createdAt: "2024-02-10T22:16:56.542Z",
              updatedAt: "2024-02-13T22:16:56.543Z",
              privateInfo: null,
              publicInfo: null,
              finished: true,
              participantId: "6b5112d6-93ba-471f-9d76-7deec118ab89",
              studyId: "replication-test",
              metadata: null,
            },
          ],
        },
      };
      // @ts-ignore (typescript doesn't recognize the mock function)
      global.fetch = jest.fn((fetchUrl: string, fetchOptions) => {
        // Mock just one option of using fetch
        const method = fetchOptions?.method?.toUpperCase() || "GET";
        const endpoint = fetchUrl.replace(REPLICATION_SOURCE_URL, "");

        const matchingEndpoints = Object.keys(MOCK_RESPONSES).filter((k) =>
          endpoint.startsWith(k),
        );
        if (matchingEndpoints.length != 1) {
          throw new Error(
            `N = ${matchingEndpoints.length} mock responses are matching the provided endpoint: ${endpoint}.`,
          );
        }

        // @ts-ignore
        const matchingRespone = MOCK_RESPONSES[matchingEndpoints[0]][method];
        if (matchingRespone === undefined) {
          throw new Error(`No mock response for "${endpoint}" "${method}"`);
        }

        let data: Array<object> | object;
        if (typeof matchingRespone == "function") {
          // Function => execute it
          data = matchingRespone({ endpoint });
        } else if (Array.isArray(matchingRespone)) {
          // Array => get slices via limit and offset
          const url = new URL(endpoint, "http://localhost");
          const limit = parseInt(url.searchParams.get("limit") as string);
          const offset = parseInt(url.searchParams.get("offset") as string);

          data = matchingRespone.slice(offset, offset + limit);
        } else {
          // Else just return as is
          data = matchingRespone;
        }

        return Promise.resolve({
          json: () => Promise.resolve(data),
        });
      }) as jest.MockedFunction<typeof fetch>;
    });

    it("should work as intended", async () => {
      const response = await endpoint
        .get(`/v1/replication/destination/update`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      // Perform multiple mocked fetch requests here as part of the update

      // Response should be correct
      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      // New data should be inserted
      const nStudies = await sequelize.models.Study.count({
        where: {
          studyId: "replication-test",
        },
      });
      expect(nStudies).toBe(1);
      const sessions = await sequelize.models.Session.findAll({
        where: {
          studyId: "replication-test",
        },
      });
      expect(sessions.length).toBe(4);
      // @ts-ignore
      const participantIds = sessions.map((s) => s.participantId);
      // @ts-ignore
      const sessionIds = sessions.map((s) => s.sessionId);

      const nParticipants = await sequelize.models.Participant.count({
        where: {
          participantId: {
            [Op.in]: participantIds,
          },
        },
      });
      expect(nParticipants).toBe(2);

      const nResponses = await sequelize.models.Response.count({
        where: {
          sessionId: {
            [Op.in]: sessionIds,
          },
        },
      });
      expect(nResponses).toBe(5);
    });

    it("should fail when not configured to act as destination source", async () => {
      config.replication.role = null;

      const response = await endpoint
        .get(`/v1/replication/destination/update`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .send();

      expect(response.status).toBe(418);
      expect(response.body).toMatchSnapshot();
    });

    it("should fail when not authenticated", async () => {
      const response = await endpoint
        .get(`/v1/replication/destination/update`)
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toMatchSnapshot();
    });
  });
});
