// Set up fake environment variables
import "./setup_env";

import sequelize from '../src/db';
import generateExampleData from "../src/db/exampleData"

describe('Database Models', () => {
  beforeAll(async () => {
    // Initialize Database
    await sequelize.sync();
  });

  describe('Example Data', () => {
    it('should create example data', async () => {
      await generateExampleData(sequelize)

      const nStudies = await sequelize.models.Study.count()
      expect(nStudies).toBe(1)

      const nParticipants = await sequelize.models.Participant.count()
      expect(nParticipants).toBe(2)

      const nRuns = await sequelize.models.Run.count()
      expect(nRuns).toBe(3)

      const nResponses = await sequelize.models.Response.count()
      expect(nResponses).toBe(7)
    });
  });

})