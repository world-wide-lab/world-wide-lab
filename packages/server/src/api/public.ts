import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import Sequelize from "sequelize";
import { ForeignKeyConstraintError } from "sequelize";
import { date, number, object, string } from "yup";
import { cache } from "../cache.js";
import config from "../config.js";
import sequelize from "../db/index.js";
import { getDbVersion } from "../db/replication.js";
import { AppError } from "../errors.js";

import {
  type CreateLeaderboardScoreParams,
  type CreateSessionParams,
  type LeaderboardScoreParams,
  type ParticipantParams,
  type ResponseParams,
  type SessionParams,
  type StudyParams,
  ValidationError,
  fullParticipantSchema,
  fullSessionSchema,
  leaderboardScoreSchema,
  participantSchema,
  responseSchema,
  sessionCreationRequestSchema,
  sessionSchema,
  studySchema,
} from "../schemas.js";

const routerPublic = express.Router();

const successfulResponsePayload = { success: true };

/**
 * @openapi
 * /:
 *   get:
 *     summary: Get API status
 *     tags:
 *       - main
 *     responses:
 *       '200':
 *         description: API is running
 */
routerPublic.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    res.type("text").send("World-Wide-Lab API: ✅");
  },
);

/**
 * @openapi
 * /info:
 *   get:
 *     summary: Get information about the current World-Wide-Lab instance.
 *     tags:
 *       - main
 *     responses:
 *       '200':
 *         description: Information returned successfully
 */
routerPublic.get(
  "/info",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.type("json").send({
        version: config.version,
        db_version: await getDbVersion(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /participant:
 *   post:
 *     summary: Create a new participant
 *     tags:
 *       - main
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               privateInfo:
 *                 type: object
 *               publicInfo:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Participant created successfully
 *       '500':
 *         description: Failed to create participant
 */
routerPublic.post(
  "/participant",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const participantParams = participantSchema.validateSync(req.body);
      const participant = (await sequelize.models.Participant.create(
        participantParams,
      )) as any as ParticipantParams;
      res.json({
        ...successfulResponsePayload,

        participantId: participant.participantId,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /participant/{participantId}:
 *   put:
 *     summary: Update an existing participant's data
 *     tags:
 *       - update
 *     parameters:
 *       - in: path
 *         name: participantId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the participant to update
 *     requestBody:
 *       description: New data for the participant
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               privateInfo:
 *                 type: object
 *               publicInfo:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Participant updated successfully
 *       '500':
 *         description: Failed to update participant
 */
routerPublic.put(
  "/participant/:participantId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { participantId } = req.params;
      const newData = participantSchema.validateSync(req.body);
      const participantWhere = fullParticipantSchema
        .pick(["participantId"])
        .validateSync({ participantId });
      const updatedRows = await sequelize.models.Participant.update(newData, {
        where: participantWhere,
      });
      if (updatedRows[0] === 1) {
        res.status(200).send(successfulResponsePayload);
      } else {
        throw new AppError("Unknown participantId", 400);
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /participant/{participantId}:
 *   get:
 *     summary: Retrieve public information for a participant
 *     tags:
 *       - public-info
 *     parameters:
 *       - in: path
 *         name: participantId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the participant to retrieve public information for.
 *     responses:
 *       '200':
 *         description: Public participant information as JSON.
 *       '400':
 *         description: Session does not exist.
 *       '500':
 *         description: Failed to retrieve participant information.
 */
routerPublic.get(
  "/participant/:participantId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { participantId } = req.params;
      const participantWhere = fullParticipantSchema
        .pick(["participantId"])
        .validateSync({ participantId });
      const participant = await sequelize.models.Participant.findOne({
        where: participantWhere,
        attributes: ["participantId", "publicInfo"],
      });
      if (participant) {
        res.status(200).json(participant.toJSON());
      } else {
        throw new AppError("Unknown participantId", 400);
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /study:
 *   post:
 *     summary: Create a new study
 *     tags:
 *       - main
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studyId:
 *                 type: string
 *               privateInfo:
 *                 type: object
 *               publicInfo:
 *                 type: object
 *             required:
 *               - studyId
 *     responses:
 *       '200':
 *         description: Study created successfully
 *       '500':
 *         description: Failed to create study
 */
routerPublic.post(
  "/study",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studyParams = studySchema.validateSync(req.body);
      const study = (await sequelize.models.Study.create(
        studyParams,
      )) as any as StudyParams;
      res.json({
        ...successfulResponsePayload,

        studyId: study.studyId,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /study/list:
 *   get:
 *     summary: Retrieve an array of all studies.
 *     tags:
 *       - main
 *     responses:
 *       '200':
 *         description: List of studies in form of a JSON Array of objects.
 *       '500':
 *         description: Failed to retrieve study list.
 */
routerPublic.get(
  "/study/list",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studies = await sequelize.models.Study.findAll({
        attributes: ["studyId"],
      });
      res.json(studies.map((record) => record.toJSON()));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /session:
 *   post:
 *     summary: Start a new session
 *     tags:
 *       - main
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studyId:
 *                 type: string
 *               participantId:
 *                 type: string
 *               privateInfo:
 *                 type: object
 *               publicInfo:
 *                 type: object
 *               clientMetadata:
 *                 type: object
 *             required:
 *               - studyId
 *     responses:
 *       '200':
 *         description: Session created successfully
 *       '400':
 *         description: Malformed request
 *       '500':
 *         description: Failed to create session
 */
routerPublic.post(
  "/session",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestParams: CreateSessionParams & {
        clientMetadata?: {};
      } = sessionCreationRequestSchema.validateSync(req.body);

      // Generate metadata
      requestParams.metadata = {
        wwl_version: config.version,
        userAgent: req.headers["user-agent"],
        referer: req.headers.referer,
        client: requestParams.clientMetadata,
      };

      // Keep only proper fields for the database
      const sessionParams: CreateSessionParams =
        sessionSchema.validateSync(requestParams);
      const session = (await sequelize.models.Session.create(
        sessionParams,
      )) as any as SessionParams;

      res.json({
        ...successfulResponsePayload,

        sessionId: session.sessionId,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /session/finish:
 *   post:
 *     summary: Mark a session as finished
 *     tags:
 *       - main
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *             required:
 *               - sessionId
 *     responses:
 *       '200':
 *         description: Session marked as finished successfully
 *       '500':
 *         description: Failed to update session
 */
routerPublic.post(
  "/session/finish",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionWhere = fullSessionSchema
        .pick(["sessionId"])
        .validateSync(req.body);
      const updatedRows = await sequelize.models.Session.update(
        { finished: true },
        { where: sessionWhere },
      );
      if (updatedRows[0] === 1) {
        res.status(200).send(successfulResponsePayload);
      } else {
        throw new AppError("Unknown sessionId", 400);
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /session/{sessionId}:
 *   put:
 *     summary: Update a session
 *     tags:
 *       - update
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the session to update
 *     requestBody:
 *       description: New data for the session
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               privateInfo:
 *                 type: object
 *               publicInfo:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Session updated successfully
 *       '500':
 *         description: Failed to update session
 */
routerPublic.put(
  "/session/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const sessionWhere = fullSessionSchema
        .pick(["sessionId"])
        .validateSync({ sessionId });
      const sessionParams = sessionSchema
        .omit(["studyId", "participantId"])
        .validateSync(req.body);

      const updatedRows = await sequelize.models.Session.update(sessionParams, {
        where: sessionWhere,
      });
      if (updatedRows[0] === 1) {
        res.status(200).send(successfulResponsePayload);
      } else {
        throw new AppError("Unknown sessionId", 400);
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /session/{sessionId}:
 *   get:
 *     summary: Retrieve public information for a session
 *     tags:
 *       - public-info
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the session to retrieve public information for.
 *     responses:
 *       '200':
 *         description: Public session information as JSON.
 *       '400':
 *         description: Session does not exist.
 *       '500':
 *         description: Failed to retrieve session information.
 */
routerPublic.get(
  "/session/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const sessionWhere = fullSessionSchema
        .pick(["sessionId"])
        .validateSync({ sessionId });
      const session = await sequelize.models.Session.findOne({
        where: sessionWhere,
        attributes: ["sessionId", "publicInfo"],
      });
      if (session) {
        res.status(200).json(session.toJSON());
      } else {
        throw new AppError("Unknown sessionId", 400);
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /response:
 *   post:
 *     summary: Submit a response
 *     tags:
 *       - main
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               name:
 *                 type: string
 *               payload:
 *                 type: object
 *             required:
 *               - sessionId
 *               - name
 *               - payload
 *     responses:
 *       '200':
 *         description: Response created successfully
 *       '400':
 *         description: Invalid request body, either misformatted or the sessionId does not exist
 *       '500':
 *         description: Failed to create response
 */
routerPublic.post(
  "/response",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const responseParams = responseSchema.validateSync(req.body);
      const response = (await sequelize.models.Response.create(
        responseParams,
      )) as any as ResponseParams;
      res.json({
        ...successfulResponsePayload,

        responseId: response.responseId,
      });
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        next(new AppError("Unknown sessionId", 400));
      } else {
        next(error);
      }
    }
  },
);

/**
 * @openapi
 * /study/{studyId}/count/{countType}:
 *   get:
 *     summary: Retrieve the number of sessions for a study
 *     description: >
 *       This endpoint is used to count the number of sessions for a study.
 *     tags:
 *       - main
 *     parameters:
 *       - in: path
 *         name: studyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the study to retrieve data for
 *       - in: path
 *         name: countType
 *         schema:
 *           type: string
 *           enum: [
 *             all,
 *             finished,
 *             usingResponses
 *          ]
 *         required: true
 *         description: >
 *           Which type of count should be used?
 *       - in: query
 *         name: cacheFor
 *         schema:
 *           type: integer
 *         required: false
 *         description: Cache the result for this many seconds.
 *       - in: query
 *         name: minResponseCount
 *         schema:
 *           type: integer
 *         required: false
 *         description: >
 *           Minimum number of responses before a session is counted.
 *           Only used for countType = usingResponses, defaults to 2.
 *     responses:
 *       '200':
 *         description: Successfully retrieved study count.
 *       '400':
 *         description: Study does not exist.
 *       '500':
 *         description: Failed to retrieve study count.
 */
routerPublic.get(
  "/study/:studyId/count/:countType",
  async (req: Request, res: Response, next: NextFunction) => {
    const { studyId, countType } = req.params;
    const { cacheFor, minResponseCount } = object({
      cacheFor: number().integer().optional(),
      minResponseCount: number()
        .integer()
        .test(
          "allow-only-for-usingResponses",
          "Setting minResponseCount is only supported for the countType 'usingResponses'",
          (value) => countType === "usingResponses" || !!value,
        )
        .optional()
        .default(2),
    }).validateSync(req.query);

    try {
      // Filter by studyId by default
      const where: { [key: string]: any } = { studyId };
      const getCountOptions: { [key: string]: any } = {};

      if (countType === "all") {
        // Do nothing, retrieve all
      } else if (countType === "finished") {
        where.finished = true;
      } else if (countType === "usingResponses") {
        // TODO: Eventually handle this via a subquery once sequelize v7 allows escaping. Else we can do it, but have to escape ourselves (which differs by dialect)
        getCountOptions.include = [
          {
            model: sequelize.models.Response,
            // No need to retrieve response attributes
            attributes: [],
          },
        ];
        getCountOptions.group = ["Session.sessionId"];
        getCountOptions.having = Sequelize.literal(
          `COUNT(Responses.responseId) >= ${minResponseCount}`,
        );
      } else {
        throw new AppError(`Unknown countType: ${countType}`, 400);
      }

      const getCount =
        countType === "usingResponses"
          ? async () => {
              const result = await sequelize.models.Session.count({
                where,
                ...getCountOptions,
              });
              // @ts-ignore Sequelize typing is wrong here. However, ideally we'd solve this differently anyways (see above TODO)
              return result.length;
            }
          : async () =>
              await sequelize.models.Session.count({
                where,
                ...getCountOptions,
              });

      const count =
        cacheFor === undefined
          ? await getCount()
          : await cache.wrap(req.path, getCount, cacheFor * 1000);

      // When the count is 0, check whether it may be due to the study not existing
      if (count === 0) {
        const study = await sequelize.models.Study.findOne({
          where: { studyId },
        });
        if (!study) {
          throw new AppError("Unknown studyId", 400);
        }
      }

      res.status(200).json({ count });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /study/count-all/{countType}:
 *   get:
 *     summary: Retrieve the number of sessions for each study
 *     description: >
 *       This endpoint is used to count the number of sessions for each study
 *     tags:
 *       - main
 *     parameters:
 *       - in: path
 *         name: countType
 *         schema:
 *           type: string
 *           enum: [
 *             all,
 *             finished
 *          ]
 *         required: true
 *         description: >
 *           Which type of count should be used?
 *       - in: query
 *         name: cacheFor
 *         schema:
 *           type: integer
 *         required: false
 *         description: Cache the result for this many seconds.
 *     responses:
 *       '200':
 *         description: Successfully retrieved study counts.
 *       '500':
 *         description: Failed to retrieve study counts.
 */
routerPublic.get(
  "/study/count-all/:countType",
  async (req: Request, res: Response, next: NextFunction) => {
    const { countType } = req.params;
    const { cacheFor } = object({
      cacheFor: number().integer().optional(),
    }).validateSync(req.query);

    try {
      // Filter by studyId by default
      const where: { [key: string]: any } = {};
      if (countType === "all") {
        // Do nothing, retrieve all
      } else if (countType === "finished") {
        where.finished = true;
      } else {
        throw new AppError(`Unknown countType: ${countType}`, 400);
      }

      const getCounts = async () => {
        const rawCounts = await sequelize.models.Session.count({
          group: ["studyId"],
          where,
        });
        const allStudies = await sequelize.models.Study.findAll({
          attributes: ["studyId"],
        });
        const finalCounts: { [key: string]: number } = {};
        allStudies.map((study) => {
          // @ts-ignore
          const studyId = study.studyId;
          const count = rawCounts.find((c) => c.studyId === studyId);
          finalCounts[studyId] = count ? count.count : 0;
        });
        return finalCounts;
      };

      const finalCounts =
        cacheFor === undefined
          ? await getCounts()
          : await cache.wrap(req.path, getCounts, cacheFor * 1000);

      res.status(200).json(finalCounts);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /leaderboard/{leaderboardId}/score:
 *   post:
 *     summary: Add a score to a leaderboard
 *     tags:
 *       - leaderboard
 *     parameters:
 *       - in: path
 *         name: leaderboardId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the leaderboard to update
 *     requestBody:
 *       description: Data for the new score on the leaderboard
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               score:
 *                 type: integer
 *                 required: true
 *               publicIndividualName:
 *                 type: string
 *               publicGroupName:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Leaderboard score added successfully. Will return the leaderboardScoreId.
 *       '500':
 *         description: Failed to add score to leaderboard
 */
const leaderboardAddScoreHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let scoreParams: CreateLeaderboardScoreParams | undefined;
  try {
    const { leaderboardId } = leaderboardScoreSchema
      .pick(["leaderboardId"])
      .validateSync(req.params);
    scoreParams = {
      leaderboardId,
      ...leaderboardScoreSchema.omit(["leaderboardId"]).validateSync(req.body),
    };

    const score = (await sequelize.models.LeaderboardScore.create(
      scoreParams,
    )) as any as LeaderboardScoreParams;

    res.json({
      ...successfulResponsePayload,
      leaderboardScoreId: score.leaderboardScoreId,
    });
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError && scoreParams) {
      const leaderboard = await sequelize.models.Leaderboard.findOne({
        where: { leaderboardId: scoreParams.leaderboardId },
      });
      if (!leaderboard) {
        next(new AppError("Unknown leaderboardId", 400));
      } else {
        next(new AppError("Unknown sessionId", 400));
      }
    } else {
      next(error);
    }
  }
};
routerPublic.post(
  "/leaderboard/:leaderboardId/score",
  leaderboardAddScoreHandler,
);
// Support for the put variant is only here for legacy reasons.
// TODO: Remvoe this in the next major version, alongside it's one test case
routerPublic.put(
  "/leaderboard/:leaderboardId/score",
  leaderboardAddScoreHandler,
);

/**
 * @openapi
 * /leaderboard/{leaderboardId}/score/{leaderboardScoreId}:
 *   put:
 *     summary: Update a score on a leaderboard. This requires a sessionId to be provided.
 *     tags:
 *       - leaderboard
 *     parameters:
 *       - in: path
 *         name: leaderboardId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the leaderboard to update
 *       - in: path
 *         name: leaderboardScoreId
 *         schema:
 *           type: number
 *         required: true
 *         description: ID of the score to update
 *     requestBody:
 *       description: Data for the score on the leaderboard
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *                 required: true
 *               score:
 *                 type: integer
 *                 required: true
 *               publicIndividualName:
 *                 type: string
 *               publicGroupName:
 *                 type: string

 *     responses:
 *       '200':
 *         description: Leaderboard score updated successfully
 *       '500':
 *         description: Failed to update score on leaderboard
 */
routerPublic.put(
  "/leaderboard/:leaderboardId/score/:leaderboardScoreId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { leaderboardId, leaderboardScoreId } = object({
        leaderboardId: string().required(),
        leaderboardScoreId: number().required(),
      }).validateSync(req.params);
      const { sessionId, ...scoreParams } = leaderboardScoreSchema
        .omit(["leaderboardId"])
        .noUnknown()
        .validateSync(req.body);

      const updatedRow = await sequelize.models.LeaderboardScore.update(
        scoreParams,
        {
          where: {
            leaderboardId,
            leaderboardScoreId,
            sessionId,
          },
        },
      );

      if (updatedRow && updatedRow[0] === 1) {
        res.status(200).send(successfulResponsePayload);
      } else {
        throw new AppError(
          "Unable to update score. Most likely issue: Unknown leaderboardId, leaderboardScoreId, or sessionId.",
          400,
        );
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /leaderboard/{leaderboardId}/scores/{level}:
 *   get:
 *     summary: Retrieve scores for a leaderboard
 *     description: >
 *       This endpoint is used to get a table of scores from a leaderboard.
 *     tags:
 *       - leaderboard
 *     parameters:
 *       - in: path
 *         name: leaderboardId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the leaderboard to retrieve scores for
 *       - in: path
 *         name: level
 *         schema:
 *           type: string
 *           enum: [
 *             individual,
 *             groups
 *           ]
 *         required: true
 *         description: >
 *           Which level of scores to retrieve.
 *       - in: query
 *         name: cacheFor
 *         schema:
 *           type: integer
 *         required: false
 *         description: Cache the result for this many seconds.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         description: How many rows to return (maximally).
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [
 *             desc,
 *             asc
 *           ]
 *         required: false
 *         default: desc
 *         description: In which direction to sort the scores.
 *       - in: query
 *         name: aggregate
 *         schema:
 *           type: string
 *           enum: [
 *             none,
 *             sum
 *           ]
 *         required: false
 *         description: Should scores be aggregated? If so, how?
 *       - in: query
 *         name: updatedAfter
 *         example: 2000-01-01T00:00:00Z
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: >
 *           Filter scores to only those updated after and including this time.
 *           Useful for rolling leaderboards e.g. only the last week or month.
 *       - in: query
 *         name: publicIndividualName
 *         schema:
 *           type: string
 *         required: false
 *         description: >
 *          Filter scores to only those with this publicIndividualName.
 *       - in: query
 *         name: publicGroupName
 *         schema:
 *           type: string
 *         required: false
 *         description: >
 *          Filter scores to only those with this publicGroupName.
 *     responses:
 *       '200':
 *         description: Successfully retrieved leaderboard scores.
 *       '400':
 *         description: Leaderboard does not exist.
 *       '500':
 *         description: Failed to retrieve leaderboard.
 */
routerPublic.get(
  "/leaderboard/:leaderboardId/scores/:level",
  async (req: Request, res: Response, next: NextFunction) => {
    // Potential extra query parameter:
    // aggregateOn: scoreLevel, sessionId, participantId
    const { leaderboardId, level } = object({
      leaderboardId: string().required(),
      level: string().oneOf(["individual", "groups"]).required(),
    }).validateSync(req.params);
    const {
      cacheFor,
      limit,
      publicIndividualName,
      publicGroupName,
      sort,
      aggregate,
      updatedAfter,
    } = object({
      cacheFor: number().integer().optional(),
      limit: number().integer().optional(),
      sort: string().oneOf(["asc", "desc"]).optional().default("desc"),
      aggregate: string().oneOf(["none", "sum"]).optional(),
      updatedAfter: date().optional(),
      publicIndividualName: string().optional(),
      publicGroupName: string().optional(),
    }).validateSync(req.query);

    try {
      // Filter by leaderboardId
      const where: { [key: string]: any } = { leaderboardId };
      const attributes: any = [];
      const extraQuerySettings: { [key: string]: any } = {};

      // Construct info for query
      if (!aggregate || aggregate === "none") {
        attributes.push("publicIndividualName");
        attributes.push("publicGroupName");
      } else {
        if (level === "individual") {
          attributes.push("publicIndividualName");
        } else if (level === "groups") {
          attributes.push("publicGroupName");
        } else {
          throw new AppError(`Unknown level: ${level}`, 400);
        }
      }

      if (limit) {
        extraQuerySettings.limit = limit;
      }

      if (sort) {
        let sortName;
        if (sort === "asc") {
          sortName = "ASC";
        } else if (sort === "desc") {
          sortName = "DESC";
        } else {
          throw new AppError(`Unknown sort: ${sort}`, 400);
        }
        extraQuerySettings.order = [["score", sortName]];
      }

      if (updatedAfter) {
        where.updatedAt = {
          [Sequelize.Op.gte]: updatedAfter,
        };
      }
      if (publicIndividualName) {
        where.publicIndividualName = publicIndividualName;
      }
      if (publicGroupName) {
        where.publicGroupName = publicGroupName;
      }

      let getScores;
      if (aggregate && aggregate !== "none") {
        // Aggregate scores
        if (aggregate === "sum") {
          // Calculate the sum of scores
          attributes.push([
            sequelize.fn("sum", sequelize.col("score")),
            "score",
          ]);
        } else {
          throw new AppError(`Unknown aggregate: ${aggregate}`, 400);
        }

        getScores = async () =>
          await sequelize.models.LeaderboardScore.findAll({
            attributes,
            where,
            group: [
              level === "individual"
                ? "publicIndividualName"
                : "publicGroupName",
            ],
            raw: true,
            ...extraQuerySettings,
          });
      } else {
        // Direct scores
        attributes.push("score");

        getScores = async () =>
          await sequelize.models.LeaderboardScore.findAll({
            attributes,
            where,
            raw: true,

            ...extraQuerySettings,
          });
      }

      const scores =
        cacheFor === undefined
          ? await getScores()
          : await cache.wrap(req.path + req.query, getScores, cacheFor * 1000);

      // When the count is 0, check whether it may be due to the study not existing
      if (scores.length === 0) {
        const leaderboard = await sequelize.models.Leaderboard.findOne({
          where: { leaderboardId },
        });
        if (!leaderboard) {
          throw new AppError("Unknown leaderboardId", 400);
        }
      }

      res.status(200).json({ scores });
    } catch (error) {
      next(error);
    }
  },
);

export { routerPublic };
