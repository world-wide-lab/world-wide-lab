import { Sequelize } from "sequelize";
import { logger } from "../logger";

async function generateExampleData(sequelize: Sequelize) {
  const studyId = "example";

  const exampleStudyCount = (
    await sequelize.models.Study.findAndCountAll({
      where: {
        studyId,
      },
    })
  ).count;

  if (exampleStudyCount > 0) {
    // Data has already been generated
    return;
  }
  logger.info("Generating Example Data");
  await sequelize.models.Study.create({
    studyId,
  });

  async function generateParticipantData(data: {
    privateInfo: Object;
    runs: Array<number>;
    createdAt?: Date;
    finished_after_runs?: number;
  }) {
    const { privateInfo, runs, createdAt, finished_after_runs } = data;
    const participant = await sequelize.models.Participant.create({
      privateInfo,
      createdAt,
    });
    for (let runIndex = 0; runIndex < runs.length; runIndex++) {
      const n_responses = runs[runIndex];
      const run = await sequelize.models.Run.create({
        // @ts-ignore
        participantId: participant.participantId,
        studyId,
        createdAt,
        finished:
          finished_after_runs === undefined
            ? false
            : n_responses >= finished_after_runs,
      });
      const responses = [];
      for (let index = 1; index <= n_responses; index++) {
        responses.push({
          // @ts-ignore
          runId: run.runId,
          name: `trial-${index}`,
          payload: {
            response: `Response #${index}`,
          },
        });
      }
      await sequelize.models.Response.bulkCreate(responses);
    }
  }

  function daysAgo(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  await generateParticipantData({
    privateInfo: {
      description: "Example User #1",
    },
    runs: [3],
    finished_after_runs: 3,
    createdAt: daysAgo(4),
  });
  await generateParticipantData({
    privateInfo: {
      description: "Example User #2",
    },
    runs: [3],
    finished_after_runs: 3,
    createdAt: daysAgo(3),
  });
  await generateParticipantData({
    privateInfo: {
      description: "Example User #3",
    },
    runs: [3, 3, 1, 3],
    finished_after_runs: 3,
    createdAt: daysAgo(2),
  });
  await generateParticipantData({
    privateInfo: {
      description: "Example User #4",
    },
    runs: [3, 1],
    finished_after_runs: 3,
    createdAt: daysAgo(1),
  });
}

export default generateExampleData;
