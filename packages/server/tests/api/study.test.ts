import sequelize from "../../src/db/index.js";
import {
  api,
  createStudy,
  uniqueId,
  useTestDatabase,
} from "../helpers/index.js";

beforeAll(useTestDatabase);

describe("POST /study", () => {
  it("should create a new study", async () => {
    const studyId = uniqueId("study");

    const response = await api.post("/v1/study").send({ studyId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, studyId });
    expect(await sequelize.models.Study.count({ where: { studyId } })).toBe(1);
  });

  it("should create a new study with extra info", async () => {
    const studyId = uniqueId("study");

    const response = await api.post("/v1/study").send({
      studyId,
      privateInfo: { integer: 10 },
      publicInfo: { string: "lorem" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ studyId });

    const study = await sequelize.models.Study.findOne({ where: { studyId } });
    expect(study).toHaveProperty("privateInfo", { integer: 10 });
    expect(study).toHaveProperty("publicInfo", { string: "lorem" });
  });

  it("should validate extra info", async () => {
    const response = await api
      .post("/v1/study")
      .send({ studyId: uniqueId("study"), privateInfo: 10 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error:
        "privateInfo must be a `object` type, but the final value was: `10`.",
      type: "ValidationError",
    });
  });
});

describe("GET /study/list", () => {
  it("should return a list of studies, exposing only their studyId", async () => {
    const studyIds = [await createStudy(), await createStudy()];

    const response = await api.get("/v1/study/list").send();

    expect(response.status).toBe(200);
    for (const studyId of studyIds) {
      expect(response.body).toContainEqual({ studyId });
    }
    // No study should leak anything beyond its studyId
    for (const study of response.body) {
      expect(Object.keys(study)).toEqual(["studyId"]);
    }
  });
});
