import request from "supertest";

import "./setup_env";

/**
 * Smoke tests for a *running* World-Wide-Lab server.
 *
 * These deliberately do not restate the detailed API tests that live in
 * `packages/server/tests/api/`: those run in-process, can look into the
 * database and are the place to add a case for a new endpoint or an edge case.
 * What this package adds is the part they cannot cover — that a real,
 * built and containerised server, talking to a real database over the network,
 * still works end to end.
 *
 * Point it at any server with `WWL_SERVER_URL`; without it a server is started
 * in-process.
 */

const API_KEY = process.env.DEFAULT_API_KEY;
if (API_KEY === undefined) {
  throw new Error("DEFAULT_API_KEY must not be empty");
}

const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

// Every run uses fresh ids, so repeated runs against the same (persistent)
// server neither collide with each other nor with any existing data.
let idCounter = 0;
const uniqueId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

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

const authed = <T extends request.Test>(test: T): T =>
  test.set("Authorization", `Bearer ${API_KEY}`) as T;

/** Run through a full study, exactly as a real experiment would. */
async function runStudy(options: {
  sessions: Array<{ responses: number; finished?: boolean }>;
}) {
  const studyId = uniqueId("smoke-test");

  const studyResponse = await endpoint.post("/v1/study").send({ studyId });
  expect(studyResponse.status).toBe(200);

  const participantResponse = await endpoint.post("/v1/participant").send();
  expect(participantResponse.status).toBe(200);
  const { participantId } = participantResponse.body;

  for (const spec of options.sessions) {
    const sessionResponse = await endpoint
      .post("/v1/session")
      .send({ studyId, participantId });
    expect(sessionResponse.status).toBe(200);
    const { sessionId } = sessionResponse.body;

    for (let i = 0; i < spec.responses; i++) {
      const response = await endpoint.post("/v1/response").send({
        sessionId,
        name: `trial-${i}`,
        payload: { key_1: "value 1", key_2: "value 2" },
      });
      expect(response.status).toBe(200);
    }

    if (spec.finished) {
      const finishResponse = await endpoint
        .post("/v1/session/finish")
        .send({ sessionId });
      expect(finishResponse.status).toBe(200);
    }
  }

  return { studyId, participantId };
}

describe("A running server", () => {
  it("should report its version", async () => {
    const response = await endpoint.get("/v1/info").send();

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("version");
  });

  it("should store a complete study and hand the data back out again", async () => {
    const { studyId } = await runStudy({
      sessions: [{ responses: 3, finished: true }, { responses: 1 }],
    });

    const counts = await endpoint.get(`/v1/study/${studyId}/count/all`).send();
    expect(counts.status).toBe(200);
    expect(counts.body.count).toBe(2);

    const finished = await endpoint
      .get(`/v1/study/${studyId}/count/finished`)
      .send();
    expect(finished.status).toBe(200);
    expect(finished.body.count).toBe(1);

    const responses = await authed(
      endpoint.get(`/v1/study/${studyId}/data/responses-raw/json`),
    );
    expect(responses.status).toBe(200);
    expect(responses.body.length).toBe(4);

    const sessions = await authed(
      endpoint.get(`/v1/study/${studyId}/data/sessions-raw/json`),
    );
    expect(sessions.status).toBe(200);
    expect(sessions.body.length).toBe(2);

    const participants = await authed(
      endpoint.get(`/v1/study/${studyId}/data/participants-raw/json`),
    );
    expect(participants.status).toBe(200);
    expect(participants.body.length).toBe(1);
  });

  it("should extract response payloads into columns", async () => {
    const { studyId } = await runStudy({ sessions: [{ responses: 2 }] });

    const json = await authed(
      endpoint.get(
        `/v1/study/${studyId}/data/responses-extracted-payload/json`,
      ),
    );
    expect(json.status).toBe(200);
    expect(json.body.length).toBe(2);
    expect(json.body[0].key_1).toBe("value 1");

    const csv = await authed(
      endpoint.get(`/v1/study/${studyId}/data/responses-extracted-payload/csv`),
    );
    expect(csv.status).toBe(200);
    // One header row plus one row per response
    expect(csv.text.split(/\r\n|\r|\n/).length).toBe(1 + 2);
  });

  it("should update and read back the public info of a participant", async () => {
    const created = await endpoint.post("/v1/participant").send();
    const { participantId } = created.body;

    const update = await endpoint.put(`/v1/participant/${participantId}`).send({
      privateInfo: { lorem: "ipsum" },
      publicInfo: { participantHasDoneSomething: true },
    });
    expect(update.status).toBe(200);

    const read = await endpoint.get(`/v1/participant/${participantId}`).send();
    expect(read.status).toBe(200);
    // privateInfo must never be handed out publicly
    expect(read.body).toEqual({
      participantId,
      publicInfo: { participantHasDoneSomething: true },
    });
  });

  it("should reject unknown and malformed ids", async () => {
    const unknown = await endpoint
      .get(`/v1/session/${NON_EXISTENT_UUID}`)
      .send();
    expect(unknown.status).toBe(400);

    const malformed = await endpoint.get("/v1/session/not-a-uuid").send();
    expect(malformed.status).toBe(400);
  });

  it("should protect the data endpoints with the API key", async () => {
    const { studyId } = await runStudy({ sessions: [] });
    const url = `/v1/study/${studyId}/data/participants-raw/json`;

    const withoutKey = await endpoint.get(url).send();
    expect(withoutKey.status).toBe(401);

    const withWrongKey = await endpoint
      .get(url)
      .set("Authorization", "Bearer wrong-key")
      .send();
    expect(withWrongKey.status).toBe(401);

    const withKey = await authed(endpoint.get(url));
    expect(withKey.status).toBe(200);
  });
});
