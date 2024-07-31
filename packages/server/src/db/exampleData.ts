import type { Sequelize } from "sequelize";
import { logger } from "../logger.js";

async function generateParticipantData(
  sequelize: Sequelize,
  studyId: string,
  data: {
    privateInfo: Object;
    sessions: Array<number>;
    createdAt?: Date;
    finished_after_sessions?: number;
  },
) {
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

async function checkIfStudyExists(
  sequelize: Sequelize,
  studyId: string,
): Promise<boolean> {
  const studyCount = (
    await sequelize.models.Study.findAndCountAll({
      where: {
        studyId,
      },
    })
  ).count;

  return studyCount > 0;
}

export async function generateBenchmarkingData(
  sequelize: Sequelize,
  cfg: {
    nStudies: number;
    nParticipants: number;
    nSessions: number;
    nResponses: number;
    nResponseKeys: number;
    random: boolean;
  } = {
    nStudies: 10,
    nParticipants: 10000,
    nSessions: 100000,
    nResponses: 1000000,
    nResponseKeys: 10,
    random: false,
  },
) {
  if (await checkIfStudyExists(sequelize, "benchmarking-1")) {
    // Data has already been generated
    return;
  }

  logger.info("Generating Data for Benchmarking", cfg);
  const startTime = new Date().getTime();

  const participantsPerStudy = Math.ceil(cfg.nParticipants / cfg.nStudies);
  const sessionsPerParticipant = Math.ceil(cfg.nSessions / cfg.nParticipants);
  const responsesPerSession = Math.ceil(cfg.nResponses / cfg.nSessions);

  for (let studyNo = 1; studyNo <= cfg.nStudies; studyNo++) {
    const studyId = `benchmarking-${studyNo}`;
    await sequelize.models.Study.create({
      studyId,
      publicInfo: {
        description: "Generated for benchmarking",
      },
    });
    logger.info(`Study ${studyNo}/${cfg.nStudies}: Start`);

    const nParticipants = cfg.random
      ? Math.round(Math.random() * participantsPerStudy)
      : participantsPerStudy;
    for (
      let participantNo = 0;
      participantNo < nParticipants;
      participantNo++
    ) {
      const participant = await sequelize.models.Participant.create({
        publicInfo: {
          description: "Generated for benchmarking",
        },
      });

      const nSessions = cfg.random
        ? Math.round(Math.random() * sessionsPerParticipant)
        : sessionsPerParticipant;

      for (let sessionNo = 0; sessionNo < nSessions; sessionNo++) {
        const session = await sequelize.models.Session.create({
          // @ts-ignore
          participantId: participant.participantId,
          studyId,
          finished: Math.random() > 0.5,
          publicInfo: {
            description: "Generated for benchmarking",
          },
        });

        const nResponses = cfg.random
          ? Math.round(Math.random() * responsesPerSession)
          : responsesPerSession;
        for (let responseNo = 0; responseNo < nResponses; responseNo++) {
          const nResponseKeys = cfg.random
            ? Math.round(Math.random() * cfg.nResponseKeys)
            : cfg.nResponseKeys;

          // Generate Paylaod
          const payload: { [key: string]: string } = {};
          for (let keyNo = 0; keyNo < nResponseKeys; keyNo++) {
            payload[`key-${keyNo}`] = `value-${keyNo}`;
          }

          await sequelize.models.Response.create({
            // @ts-ignore
            sessionId: session.sessionId,
            name: `response-${responseNo}`,
            payload,
          });
        }
      }
    }

    logger.info(`Study ${studyNo}/${cfg.nStudies}: End`);
  }

  logger.info(
    `Finished generating benchmarking data in ${Math.round(
      (new Date().getTime() - startTime) / 1000,
    )}s`,
  );
}

export async function generateExampleData(
  sequelize: Sequelize,
  studyId = "example",
) {
  if (await checkIfStudyExists(sequelize, studyId)) {
    // Data has already been generated
    return;
  }
  logger.info("Generating Example Data");
  await sequelize.models.Study.create({
    studyId,
  });

  await generateParticipantData(sequelize, studyId, {
    privateInfo: {
      description: "Example User #1",
    },
    sessions: [3],
    finished_after_sessions: 3,
    createdAt: daysAgo(4),
  });
  await generateParticipantData(sequelize, studyId, {
    privateInfo: {
      description: "Example User #2",
    },
    sessions: [3],
    finished_after_sessions: 3,
    createdAt: daysAgo(3),
  });
  await generateParticipantData(sequelize, studyId, {
    privateInfo: {
      description: "Example User #3",
    },
    sessions: [3, 3, 1, 3],
    finished_after_sessions: 3,
    createdAt: daysAgo(2),
  });
  await generateParticipantData(sequelize, studyId, {
    privateInfo: {
      description: "Example User #4",
    },
    sessions: [3, 1],
    finished_after_sessions: 3,
    createdAt: daysAgo(1),
  });
}
