import sequelize from "../../src/db/index.js";
import {
  NON_EXISTENT_STUDY_ID,
  api,
  createStudy,
  seedStudy,
  useTestDatabase,
} from "../helpers/index.js";
import type { StudyScenario } from "../helpers/index.js";

beforeAll(useTestDatabase);

/**
 * A study with a known shape:
 *  - 4 sessions in total
 *  - 1 of them finished
 *  - 2 of them have at least 1 response, 1 of them has at least 2 responses
 */
async function seedStudyWithKnownCounts(): Promise<StudyScenario> {
  return await seedStudy({
    sessions: [
      { finished: true, responses: 3 },
      { responses: 1 },
      { responses: 0 },
      { responses: 0 },
    ],
  });
}

describe("GET /study/:studyId/count/:countType", () => {
  it("should count all sessions", async () => {
    const { studyId } = await seedStudyWithKnownCounts();

    const response = await api.get(`/v1/study/${studyId}/count/all`).send();

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(4);
  });

  it("should count only finished sessions", async () => {
    const { studyId } = await seedStudyWithKnownCounts();

    const response = await api
      .get(`/v1/study/${studyId}/count/finished`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
  });

  it.each([
    { minResponseCount: undefined, expected: 2 },
    { minResponseCount: 2, expected: 1 },
    { minResponseCount: 50, expected: 0 },
  ])(
    "should count sessions with at least $minResponseCount responses",
    async ({ minResponseCount, expected }) => {
      const { studyId } = await seedStudyWithKnownCounts();

      const query =
        minResponseCount === undefined
          ? ""
          : `?minResponseCount=${minResponseCount}`;
      const response = await api
        .get(`/v1/study/${studyId}/count/usingResponses${query}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(expected);
    },
  );

  it("should fail when the countType does not exist", async () => {
    const studyId = await createStudy();

    const response = await api
      .get(`/v1/study/${studyId}/count/non-existent-type`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown countType: non-existent-type",
      type: "AppError",
    });
  });

  it("should fail when the study does not exist", async () => {
    const response = await api
      .get(`/v1/study/${NON_EXISTENT_STUDY_ID}/count/all`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Unknown studyId",
      type: "AppError",
    });
  });

  it("should fail when an unsupported configuration is provided", async () => {
    const studyId = await createStudy();

    const response = await api
      .get(`/v1/study/${studyId}/count/all?minResponseCount=2`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        "Setting minResponseCount is only supported for the countType 'usingResponses'",
      type: "ValidationError",
    });
  });

  it("should cache counts", async () => {
    const { studyId } = await seedStudyWithKnownCounts();
    const countSpy = vi.spyOn(sequelize.models.Session, "count");

    try {
      const url = `/v1/study/${studyId}/count/all?cacheFor=300`;

      // First call: nothing is cached yet, so the database is queried
      const response = await api.get(url).send();
      expect(response.status).toBe(200);
      expect(response.body.count).toBe(4);
      expect(countSpy).toHaveBeenCalledTimes(1);

      // Second call: served from the cache, without touching the database
      const cachedResponse = await api.get(url).send();
      expect(cachedResponse.status).toBe(200);
      expect(cachedResponse.body.count).toBe(4);
      expect(countSpy).toHaveBeenCalledTimes(1);
    } finally {
      countSpy.mockRestore();
    }
  });
});

describe("GET /study/count-all/:countType", () => {
  it("should count all sessions, per study", async () => {
    const { studyId } = await seedStudyWithKnownCounts();
    const emptyStudyId = await createStudy();

    const response = await api.get("/v1/study/count-all/all").send();

    expect(response.status).toBe(200);
    expect(response.body[studyId]).toBe(4);
    expect(response.body[emptyStudyId]).toBe(0);
  });

  it("should count finished sessions, per study", async () => {
    const { studyId } = await seedStudyWithKnownCounts();
    const emptyStudyId = await createStudy();

    const response = await api.get("/v1/study/count-all/finished").send();

    expect(response.status).toBe(200);
    expect(response.body[studyId]).toBe(1);
    expect(response.body[emptyStudyId]).toBe(0);
  });
});
