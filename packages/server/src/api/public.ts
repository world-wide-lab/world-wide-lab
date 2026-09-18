import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import Sequelize from "sequelize";
import { ForeignKeyConstraintError } from "sequelize";
import { date, number, object, string } from "yup";
import { cache, getCacheKey } from "../cache.js";
import config from "../config.js";
import sequelize from "../db/index.js";
import {
  type DrawPolicy,
  type ModerationMode,
  completeDraw,
  drawItems,
  itemTransaction,
  visibleItemStatuses,
} from "../db/items.js";
import { getDbVersion } from "../db/replication.js";
import { AppError } from "../errors.js";
import { sanitizeNullBytes } from "../validation/sanitization.js";

import {
  type CreateLeaderboardScoreParams,
  type CreateSessionParams,
  type ItemParams,
  type ItemPoolParams,
  type LeaderboardScoreParams,
  type ParticipantParams,
  type ResponseParams,
  type SessionParams,
  type StudyParams,
  ValidationError,
  drawQuerySchema,
  fullParticipantSchema,
  fullSessionSchema,
  itemContributionSchema,
  itemListQuerySchema,
  leaderboardScoreSchema,
  participantSchema,
  responseCreationRequestSchema,
  sessionCreationRequestSchema,
  sessionSchema,
  studySchema,
} from "../validation/schemas.js";

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
      const participantParams = sanitizeNullBytes(
        participantSchema.validateSync(req.body),
      );
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
      const newData = sanitizeNullBytes(
        participantSchema.validateSync(req.body),
      );
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
      const studyParams = sanitizeNullBytes(studySchema.validateSync(req.body));
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
      const sessionParams: CreateSessionParams = sanitizeNullBytes(
        sessionSchema.validateSync(requestParams),
      );
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
      const sessionParams = sanitizeNullBytes(
        sessionSchema.omit(["studyId", "participantId"]).validateSync(req.body),
      );

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
 *               drawId:
 *                 type: string
 *                 description: The draw this response was produced in reaction to.
 *               completesDraw:
 *                 type: boolean
 *                 default: true
 *                 description: >
 *                   Whether this response completes the draw it refers to.
 *                   False on trials which are only part of a reaction.
 *             required:
 *               - sessionId
 *               - name
 *               - payload
 *     responses:
 *       '200':
 *         description: Response created successfully
 *       '400':
 *         description: Invalid request body, either misformatted or the sessionId or drawId does not exist
 *       '500':
 *         description: Failed to create response
 */
routerPublic.post(
  "/response",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { completesDraw, ...responseParams } = sanitizeNullBytes(
        responseCreationRequestSchema.validateSync(req.body),
      );

      if (responseParams.drawId === undefined) {
        const response = (await sequelize.models.Response.create(
          responseParams,
        )) as any as ResponseParams;
        res.json({
          ...successfulResponsePayload,

          responseId: response.responseId,
        });
        return;
      }

      // A response reacting to a drawn item is written together with the
      // completion of its draw, so that the two can never disagree.
      const { drawId, sessionId } = responseParams;
      const responseId = await itemTransaction(async (transaction) => {
        const draw = await sequelize.models.ItemDraw.findOne({
          where: { drawId, sessionId },
          transaction,
        });
        if (!draw) {
          // Also covers a draw which belongs to somebody else's session
          throw new AppError("Unknown drawId", 400);
        }

        const response = (await sequelize.models.Response.create(
          responseParams,
          { transaction },
        )) as any as ResponseParams;

        // Closing the draw is the default, since reacting to an item with a
        // single response is the common case. Trials which only make up part
        // of a reaction pass completesDraw: false and let the last one close
        // the draw.
        if (completesDraw !== false) {
          await completeDraw(drawId as string, sessionId, transaction);
        }

        return response.responseId;
      });

      res.json({
        ...successfulResponsePayload,

        responseId,
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
 *           Only used for countType = usingResponses, defaults to 1.
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
    try {
      const { studyId, countType } = req.params;
      const { cacheFor, minResponseCount } = object({
        cacheFor: number().integer().optional(),
        minResponseCount: number()
          .integer()
          .test(
            "allow-only-for-usingResponses",
            "Setting minResponseCount is only supported for the countType 'usingResponses'",
            (value) => countType === "usingResponses" || !value,
          )
          .optional(),
      }).validateSync(req.query);

      // Filter by studyId by default
      const where: { [key: string]: any } = { studyId };
      let getCount: (() => Promise<number>) | undefined;

      if (countType === "all") {
        // Do nothing, retrieve all
      } else if (countType === "finished") {
        where.finished = true;
      } else if (countType === "usingResponses") {
        // Use the correct separator per dialect
        const s = sequelize.getDialect() === "sqlite" ? "`" : '"';
        getCount = async () => {
          const effectiveMinResponseCount = minResponseCount ?? 1;
          const result = await sequelize.query<{ count: number }>(
            `
              SELECT COUNT(*) as count FROM (
                SELECT
                  ${s}Session${s}.${s}sessionId${s}
                FROM ${s}wwl_sessions${s} AS ${s}Session${s}
                INNER JOIN ${s}wwl_responses${s} AS ${s}Responses${s}
                  ON ${s}Session${s}.${s}sessionId${s} = ${s}Responses${s}.${s}sessionId${s}
                WHERE ${s}Session${s}.${s}studyId${s} = :studyId
                GROUP BY ${s}Session${s}.${s}sessionId${s}
                HAVING COUNT(${s}Responses${s}.${s}responseId${s}) >= :effectiveMinResponseCount
              );
            `,
            {
              type: Sequelize.QueryTypes.SELECT,
              replacements: {
                studyId,
                effectiveMinResponseCount,
              },
            },
          );
          return result[0].count;
        };
      } else {
        throw new AppError(`Unknown countType: ${countType}`, 400);
      }

      if (!getCount) {
        getCount = async () =>
          await sequelize.models.Session.count({
            where,
          });
      }

      const count =
        cacheFor === undefined
          ? await getCount()
          : await cache.wrap(getCacheKey(req), getCount, cacheFor * 1000);

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
          : await cache.wrap(getCacheKey(req), getCounts, cacheFor * 1000);

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
routerPublic.post(
  "/leaderboard/:leaderboardId/score",
  async (req: Request, res: Response, next: NextFunction) => {
    let scoreParams: CreateLeaderboardScoreParams | undefined;
    try {
      const { leaderboardId } = leaderboardScoreSchema
        .pick(["leaderboardId"])
        .validateSync(req.params);
      scoreParams = sanitizeNullBytes({
        leaderboardId,
        ...leaderboardScoreSchema
          .omit(["leaderboardId"])
          .validateSync(req.body),
      });

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
  },
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
      const sanitizedScoreParams = sanitizeNullBytes(scoreParams);

      const updatedRow = await sequelize.models.LeaderboardScore.update(
        sanitizedScoreParams,
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
          : await cache.wrap(getCacheKey(req), getScores, cacheFor * 1000);

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

// --- Item Pools ------------------------------------------------------------
// Pools let participants see what other participants produced: a session
// contributes an item to a pool, and other sessions draw items back out of it.
// Which items may be handed out is decided by the pool (moderation), what to
// hand out right now is decided by the query (policy, caps, exclusions).

const poolIdSchema = object({ poolId: string().required() });

// Only ever hand these fields back out. Everything else on an item (who
// contributed it, its privateInfo, how often it has been served) is internal.
function toPublicItem(item: any) {
  return {
    itemId: item.itemId,
    publicPayload: item.publicPayload,
    generation: item.generation,
    parentItemId: item.parentItemId,
  };
}

async function getPoolOrFail(poolId: string) {
  const pool = (await sequelize.models.ItemPool.findOne({
    where: { poolId },
  })) as any as ItemPoolParams | null;
  if (!pool) {
    throw new AppError("Unknown poolId", 400);
  }
  return pool;
}

/**
 * @openapi
 * /item-pool/{poolId}/item:
 *   post:
 *     summary: Contribute an item to a pool
 *     description: >
 *       Add a new item to a pool. Whether it is shown to others right away
 *       depends on the pool's moderation setting.
 *     tags:
 *       - items
 *     parameters:
 *       - in: path
 *         name: poolId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the pool to contribute to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               publicPayload:
 *                 type: object
 *                 description: >
 *                   The content of the item. Shown to other participants, so
 *                   it must not contain sensitive information.
 *               sessionId:
 *                 type: string
 *                 description: >
 *                   The session contributing the item. Optional, but without
 *                   it the item cannot be attributed, excluded from its own
 *                   author or retracted.
 *               responseId:
 *                 type: integer
 *                 description: The response this item was generated from.
 *               parentItemId:
 *                 type: string
 *                 description: The item this one was generated from.
 *               privateInfo:
 *                 type: object
 *             required:
 *               - publicPayload
 *     responses:
 *       '200':
 *         description: Item contributed successfully. Will return the itemId and its status.
 *       '400':
 *         description: Invalid request body, unknown poolId, or the pool is closed for contributions.
 *       '500':
 *         description: Failed to contribute item
 */
routerPublic.post(
  "/item-pool/:poolId/item",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { poolId } = poolIdSchema.validateSync(req.params);
      const contribution = sanitizeNullBytes(
        itemContributionSchema.validateSync(req.body),
      );

      const pool = await getPoolOrFail(poolId);

      if (pool.moderation === "closed") {
        throw new AppError(
          "This pool is closed and does not accept contributions",
          400,
        );
      }

      // The global request size limit is not a meaningful limit for content
      // other participants get to see, so pools have their own.
      const maxPayloadBytes =
        pool.maxPayloadBytes ?? config.items.defaultMaxPayloadBytes;
      const payloadBytes = Buffer.byteLength(
        JSON.stringify(contribution.publicPayload),
        "utf8",
      );
      if (payloadBytes > maxPayloadBytes) {
        throw new AppError(
          `The item's publicPayload is too large (${payloadBytes} bytes, the limit for this pool is ${maxPayloadBytes} bytes)`,
          400,
        );
      }

      // Items are always one generation further along than their parent
      let generation = 0;
      if (contribution.parentItemId !== undefined) {
        const parent = (await sequelize.models.Item.findOne({
          where: { itemId: contribution.parentItemId, poolId },
        })) as any as ItemParams | null;
        if (!parent) {
          throw new AppError("Unknown parentItemId", 400);
        }
        generation = (parent.generation ?? 0) + 1;
      }

      if (contribution.sessionId !== undefined) {
        const session = await sequelize.models.Session.findOne({
          where: { sessionId: contribution.sessionId },
        });
        if (!session) {
          throw new AppError("Unknown sessionId", 400);
        }
      }
      if (contribution.responseId !== undefined) {
        const response = await sequelize.models.Response.findOne({
          where: { responseId: contribution.responseId },
        });
        if (!response) {
          throw new AppError("Unknown responseId", 400);
        }
      }

      const item = (await sequelize.models.Item.create({
        poolId,
        publicPayload: contribution.publicPayload,
        sourceSessionId: contribution.sessionId ?? null,
        sourceResponseId: contribution.responseId ?? null,
        parentItemId: contribution.parentItemId ?? null,
        generation,
        privateInfo: contribution.privateInfo,
      })) as any as ItemParams;

      res.json({
        ...successfulResponsePayload,

        itemId: item.itemId,
        status: item.status,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /item-pool/{poolId}/draw:
 *   get:
 *     summary: Draw one or more items from a pool
 *     description: >
 *       Hand items from a pool to a session and record that they were served
 *       to it. This changes data, so results can not be cached.
 *     tags:
 *       - items
 *     parameters:
 *       - in: path
 *         name: poolId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the pool to draw from
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         required: true
 *         description: The session the items are served to.
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *         required: false
 *         default: 1
 *         description: How many items to draw.
 *       - in: query
 *         name: policy
 *         schema:
 *           type: string
 *           enum: [
 *             random,
 *             least-drawn,
 *             newest,
 *             oldest
 *           ]
 *         required: false
 *         default: random
 *         description: Which items to prefer.
 *       - in: query
 *         name: excludeOwn
 *         schema:
 *           type: boolean
 *         required: false
 *         default: true
 *         description: Skip items this participant contributed themselves.
 *       - in: query
 *         name: excludeSeen
 *         schema:
 *           type: boolean
 *         required: false
 *         default: true
 *         description: Skip items which have already been served to this session.
 *       - in: query
 *         name: maxDrawsPerItem
 *         schema:
 *           type: integer
 *         required: false
 *         description: >
 *           Only draw items served fewer than this many times. A draw counts
 *           as soon as it is served and is never returned.
 *       - in: query
 *         name: maxCompletionsPerItem
 *         schema:
 *           type: integer
 *         required: false
 *         description: Only draw items completed fewer than this many times.
 *       - in: query
 *         name: minGeneration
 *         schema:
 *           type: integer
 *         required: false
 *         description: Only draw items at or beyond this generation of a chain.
 *       - in: query
 *         name: maxGeneration
 *         schema:
 *           type: integer
 *         required: false
 *         description: Only draw items at or below this generation of a chain.
 *     responses:
 *       '200':
 *         description: >
 *           Successfully drew items. The list can be shorter than the
 *           requested count, or empty, if the pool has run out of matches.
 *       '400':
 *         description: Invalid query, unknown poolId or unknown sessionId.
 *       '500':
 *         description: Failed to draw items
 */
routerPublic.get(
  "/item-pool/:poolId/draw",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { poolId } = poolIdSchema.validateSync(req.params);
      const query = drawQuerySchema.validateSync(req.query);

      if (
        (query.minGeneration ?? 0) >
        (query.maxGeneration ?? Number.POSITIVE_INFINITY)
      ) {
        throw new AppError(
          "minGeneration can not be larger than maxGeneration",
          400,
        );
      }

      const pool = await getPoolOrFail(poolId);

      // A draw is by definition served to someone, so unlike on contribute the
      // session is required here and has to exist.
      const session = (await sequelize.models.Session.findOne({
        where: { sessionId: query.sessionId },
      })) as any as SessionParams | null;
      if (!session) {
        throw new AppError("Unknown sessionId", 400);
      }

      const results = await drawItems({
        ...query,
        poolId,
        moderation: pool.moderation as ModerationMode,
        policy: query.policy as DrawPolicy,
        participantId: session.participantId,
      });

      res.status(200).json({
        draws: results.map(({ draw, item }) => ({
          drawId: draw.drawId,
          ...toPublicItem(item),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /draw/{drawId}/complete:
 *   post:
 *     summary: Complete a draw without storing a response
 *     description: >
 *       Mark a draw as completed. Responses do this via their own drawId, so
 *       this is for outcomes which are not logged as study data.
 *     tags:
 *       - items
 *     parameters:
 *       - in: path
 *         name: drawId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the draw to complete
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
 *         description: Draw completed successfully
 *       '400':
 *         description: Unknown drawId, or the draw belongs to another session.
 *       '500':
 *         description: Failed to complete draw
 */
routerPublic.post(
  "/draw/:drawId/complete",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { drawId } = object({
        drawId: string().uuid().required(),
      }).validateSync(req.params);
      const { sessionId } = object({
        sessionId: string().uuid().required(),
      })
        .noUnknown()
        .validateSync(req.body);

      await completeDraw(drawId, sessionId);

      res.status(200).send(successfulResponsePayload);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /item-pool/{poolId}/items:
 *   get:
 *     summary: Retrieve items from a pool
 *     description: >
 *       Read items from a pool without drawing them, e.g. to show a wall of
 *       what other participants produced. Nothing is recorded, so this caches.
 *     tags:
 *       - items
 *     parameters:
 *       - in: path
 *         name: poolId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the pool to retrieve items from
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         default: 100
 *         description: How many items to return (maximally).
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [
 *             newest,
 *             oldest,
 *             random
 *           ]
 *         required: false
 *         default: newest
 *         description: In which order to return the items.
 *       - in: query
 *         name: cacheFor
 *         schema:
 *           type: integer
 *         required: false
 *         description: >
 *           Cache the result for this many seconds. Retracted items can still
 *           show up until the cache expires.
 *     responses:
 *       '200':
 *         description: Successfully retrieved items.
 *       '400':
 *         description: Unknown poolId.
 *       '500':
 *         description: Failed to retrieve items
 */
routerPublic.get(
  "/item-pool/:poolId/items",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { poolId } = poolIdSchema.validateSync(req.params);
      const { limit, sort, cacheFor } = itemListQuerySchema.validateSync(
        req.query,
      );

      const pool = await getPoolOrFail(poolId);

      // itemId breaks ties between items created in the same millisecond
      const direction = sort === "oldest" ? "ASC" : "DESC";
      const order: any =
        sort === "random"
          ? sequelize.random()
          : [
              ["createdAt", direction],
              ["itemId", direction],
            ];

      // Not raw, so that the payload comes back as JSON on every dialect
      const getItems = async () =>
        (
          await sequelize.models.Item.findAll({
            attributes: ["itemId", "publicPayload", "generation"],
            where: {
              poolId,
              status: visibleItemStatuses(pool.moderation as ModerationMode),
            },
            order,
            limit,
          })
        ).map((item) => item.toJSON());

      const items =
        cacheFor === undefined
          ? await getItems()
          : await cache.wrap(
              `${req.path}?${JSON.stringify(req.query)}`,
              getItems,
              cacheFor * 1000,
            );

      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /item/{itemId}:
 *   delete:
 *     summary: Retract an item
 *     description: >
 *       Withdraw an item a session contributed, so that it is no longer shown
 *       to anyone. Also serves participant withdrawal requests.
 *     tags:
 *       - items
 *     parameters:
 *       - in: path
 *         name: itemId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the item to retract
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
 *         description: Item retracted successfully
 *       '400':
 *         description: Unknown itemId, or the item was not contributed by this session.
 *       '500':
 *         description: Failed to retract item
 */
routerPublic.delete(
  "/item/:itemId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = object({
        itemId: string().uuid().required(),
      }).validateSync(req.params);
      const { sessionId } = object({
        sessionId: string().uuid().required(),
      })
        .noUnknown()
        .validateSync(req.body);

      // A session may only ever retract what it contributed itself
      const [updatedRows] = await sequelize.models.Item.update(
        { status: "rejected" },
        { where: { itemId, sourceSessionId: sessionId } },
      );

      if (updatedRows === 1) {
        res.status(200).send(successfulResponsePayload);
      } else {
        throw new AppError(
          "Unable to retract item. Most likely issue: Unknown itemId, or the item was not contributed by this session.",
          400,
        );
      }
    } catch (error) {
      next(error);
    }
  },
);

export { routerPublic };
