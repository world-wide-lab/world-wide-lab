import sequelize from "../src/db";
import { ensureStudiesExist } from "../src/db/ensureStudiesExist";
import { generateExampleData } from "../src/db/exampleData";
import { resetDatabase, useTestDatabase } from "./helpers/index.js";

describe("Database Models", () => {
  beforeAll(useTestDatabase);
  beforeEach(resetDatabase);

  describe("Example Data", () => {
    it("should create example data", async () => {
      await generateExampleData(sequelize);

      expect(await sequelize.models.Study.count()).toBe(1);
      expect(await sequelize.models.Participant.count()).toBe(4);
      expect(await sequelize.models.Session.count()).toBe(8);
      expect(await sequelize.models.Response.count()).toBe(20);
    });
  });

  describe("Ensure Studies Exist", () => {
    it("should create the requested studies", async () => {
      await ensureStudiesExist(sequelize, ["study1", "study2"]);

      expect(await sequelize.models.Study.count()).toBe(2);
    });

    it("should not try to create already existing studies", async () => {
      await ensureStudiesExist(sequelize, ["study1", "study2"]);
      await ensureStudiesExist(sequelize, ["study2", "study3"]);

      expect(await sequelize.models.Study.count()).toBe(3);
    });
  });
});
