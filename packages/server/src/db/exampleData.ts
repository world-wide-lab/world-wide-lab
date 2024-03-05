import { Sequelize } from "sequelize";
import { logger } from "../logger";

async function generateExampleData(
  sequelize: Sequelize,
  studyId: string = "example",
) {
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
    sessions: Array<number>;
    createdAt?: Date;
    finished_after_sessions?: number;
  }) {
    const { privateInfo, sessions, createdAt, finished_after_sessions } = data;
    const participant = await sequelize.models.Participant.create({
      privateInfo,
      createdAt,
    });
    for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex++) {
      const n_responses = sessions[sessionIndex];
      const session = await sequelize.models.Session.create({
        // @ts-ignore
        participantId: participant.participantId,
        studyId,
        createdAt,
        finished:
          finished_after_sessions === undefined
            ? false
            : n_responses >= finished_after_sessions,
      });
      const responses = [];
      for (let index = 1; index <= n_responses; index++) {
        responses.push({
          // @ts-ignore
          sessionId: session.sessionId,
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
    sessions: [3],
    finished_after_sessions: 3,
    createdAt: daysAgo(4),
  });
  await generateParticipantData({
    privateInfo: {
      description: "Example User #2",
    },
    sessions: [3],
    finished_after_sessions: 3,
    createdAt: daysAgo(3),
  });
  await generateParticipantData({
    privateInfo: {
      description: "Example User #3",
    },
    sessions: [3, 3, 1, 3],
    finished_after_sessions: 3,
    createdAt: daysAgo(2),
  });
  await generateParticipantData({
    privateInfo: {
      description: "Example User #4",
    },
    sessions: [3, 1],
    finished_after_sessions: 3,
    createdAt: daysAgo(1),
  });
}

export default generateExampleData;
