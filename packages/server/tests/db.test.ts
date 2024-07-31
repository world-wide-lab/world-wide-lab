// Set up fake environment variables
import "./setup_env";

import sequelize from "../src/db";
import { ensureStudiesExist } from "../src/db/ensureStudiesExist";
import { generateExampleData } from "../src/db/exampleData";

describe("Database Models", () => {
  beforeAll(async () => {
    // Initialize Database
    await sequelize.sync();
  });

  describe("Example Data", () => {
    it("should create example data", async () => {
      await generateExampleData(sequelize);

      const nStudies = await sequelize.models.Study.count();
      expect(nStudies).toBe(1);

      const nParticipants = await sequelize.models.Participant.count();
      expect(nParticipants).toBe(4);

      const nSessions = await sequelize.models.Session.count();
      expect(nSessions).toBe(8);

      const nResponses = await sequelize.models.Response.count();
      expect(nResponses).toBe(20);
    });
  });

  describe("Ensure Studies Exist", () => {
    it("should properly created requested studies", async () => {
      await ensureStudiesExist(sequelize, ["study1", "study2"]);
      // example, study1, study2
      expect(await sequelize.models.Study.count()).toBe(3);
    });
    it("should not try to create already existing studies", async () => {
      await ensureStudiesExist(sequelize, ["study2", "study3"]);
      // example, study1, study2, study3
      expect(await sequelize.models.Study.count()).toBe(4);
    });
  });
});
