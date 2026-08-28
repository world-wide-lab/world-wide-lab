// Set up fake environment variables
import "./setup_env";

import request from "supertest";
import app from "../src/app";
import config from "../src/config";
import sequelize from "../src/db";
import {
  type CachedPayloadKey,
  clearPayloadKeyCache,
} from "../src/db/payloadKeyCache";

const endpoint = request(app);

const API_KEY = process.env.DEFAULT_API_KEY;

const cachingEnabledByDefault = config.database.cachePayloadKeys;

// Create a study with a single session to add responses to
async function createStudy(studyId: string) {
  await sequelize.models.Study.create({ studyId });
  const session = (await sequelize.models.Session.create({ studyId })) as any;
  return session.sessionId as string;
}

async function addResponse(sessionId: string, payload: object) {
  return (await sequelize.models.Response.create({
    sessionId,
    name: "trial",
    payload,
  })) as any;
}

function download(studyId: string, query = "") {
  return endpoint
    .get(`/v1/study/${studyId}/data/responses-extracted-payload/json${query}`)
    .set("Authorization", `Bearer ${API_KEY}`)
    .send();
}

// The columns of an export, without the columns of the responses table itself
async function getPayloadColumns(studyId: string, query = "") {
  const response = await download(studyId, query);
  expect(response.status).toBe(200);
  expect(response.body.length).toBeGreaterThan(0);

  const tableFields = Object.keys(sequelize.models.Response.getAttributes());
  return Object.keys(response.body[0]).filter(
    (column) => !tableFields.includes(column),
  );
}

async function getCache(studyId: string) {
  return (await sequelize.models.ResponsePayloadKeyCache.findByPk(
    studyId,
  )) as any;
}

describe("Caching of payload keys", () => {
  beforeAll(async () => {
    await sequelize.sync();
  });

  afterEach(() => {
    config.database.cachePayloadKeys = cachingEnabledByDefault;
  });

  it("should store the keys of a study when it is exported", async () => {
    const studyId = "payload-key-cache-store";
    const sessionId = await createStudy(studyId);
    const response = await addResponse(sessionId, { key_1: 1, key_2: 2 });

    expect(await getCache(studyId)).toBe(null);

    expect(await getPayloadColumns(studyId)).toEqual(["key_1", "key_2"]);

    const cache = await getCache(studyId);
    expect(cache.keys.map((entry: CachedPayloadKey) => entry.key)).toEqual([
      "key_1",
      "key_2",
    ]);
    expect(cache.lastResponseId).toBe(response.responseId);
  });

  it("should use the cached keys on the next export", async () => {
    const studyId = "payload-key-cache-reuse";
    const sessionId = await createStudy(studyId);
    await addResponse(sessionId, { key_1: 1 });

    await getPayloadColumns(studyId);

    // Add a key that is not part of any response, so that it can only come
    // from the cache
    const cache = await getCache(studyId);
    await cache.update({
      keys: [...cache.keys, { key: "cached_key", lastSeenAt: null }],
    });

    expect(await getPayloadColumns(studyId)).toEqual(["cached_key", "key_1"]);
  });

  it("should pick up keys of responses added after the last export", async () => {
    const studyId = "payload-key-cache-new-responses";
    const sessionId = await createStudy(studyId);
    await addResponse(sessionId, { key_1: 1 });

    expect(await getPayloadColumns(studyId)).toEqual(["key_1"]);

    await addResponse(sessionId, { key_2: 2 });

    expect(await getPayloadColumns(studyId)).toEqual(["key_1", "key_2"]);
  });

  it("should pick up keys of responses changed after the last export", async () => {
    const studyId = "payload-key-cache-changed-responses";
    const sessionId = await createStudy(studyId);
    const response = await addResponse(sessionId, { key_1: 1 });

    expect(await getPayloadColumns(studyId)).toEqual(["key_1"]);

    await response.update({ payload: { key_1: 1, key_2: 2 } });

    expect(await getPayloadColumns(studyId)).toEqual(["key_1", "key_2"]);
  });

  it("should only return keys of the exported responses (created_after)", async () => {
    const studyId = "payload-key-cache-created-after";
    const sessionId = await createStudy(studyId);
    const oldResponse = await addResponse(sessionId, { old_key: 1 });
    // Move the response into the past, without changing its updatedAt, so
    // that it looks like it has been created a while ago
    await sequelize.query(
      'UPDATE wwl_responses SET "createdAt" = :createdAt WHERE "responseId" = :responseId',
      {
        replacements: {
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          responseId: oldResponse.responseId,
        },
      },
    );
    await addResponse(sessionId, { new_key: 2 });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const query = `?created_after=${encodeURIComponent(oneHourAgo)}`;

    // Both when the cache is still empty and when it has been filled already
    expect(await getPayloadColumns(studyId, query)).toEqual(["new_key"]);
    expect(await getPayloadColumns(studyId, query)).toEqual(["new_key"]);

    // Without created_after, all keys are part of the export
    expect(await getPayloadColumns(studyId)).toEqual(["new_key", "old_key"]);
  });

  it("should determine the keys again after the cache has been cleared", async () => {
    const studyId = "payload-key-cache-clear";
    const sessionId = await createStudy(studyId);
    await addResponse(sessionId, { key_1: 1 });

    await getPayloadColumns(studyId);
    const cache = await getCache(studyId);
    await cache.update({
      keys: [...cache.keys, { key: "cached_key", lastSeenAt: null }],
    });

    await clearPayloadKeyCache(sequelize, studyId);
    expect(await getCache(studyId)).toBe(null);

    expect(await getPayloadColumns(studyId)).toEqual(["key_1"]);
  });

  it("should not use the cache when it is turned off", async () => {
    const studyId = "payload-key-cache-disabled";
    const sessionId = await createStudy(studyId);
    await addResponse(sessionId, { key_1: 1 });

    config.database.cachePayloadKeys = false;

    expect(await getPayloadColumns(studyId)).toEqual(["key_1"]);
    expect(await getCache(studyId)).toBe(null);
  });
});
