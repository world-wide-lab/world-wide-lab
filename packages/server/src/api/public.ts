import express, { NextFunction, Request, Response } from "express";
import { ForeignKeyConstraintError } from "sequelize";
import config from "../config";
import sequelize from "../db";
import { getDbVersion } from "../db/replication";
import { AppError } from "../errors";
import {
  CreateSessionParams,
  ParticipantParams,
  ResponseParams,
  SessionParams,
  StudyParams,
  ValidationError,
  fullParticipantSchema,
  fullSessionSchema,
  participantSchema,
  responseSchema,
  sessionCreationRequestSchema,
  sessionSchema,
  studySchema,
} from "../schemas";

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
 *             finished
 *          ]
 *         required: true
 *         description: >
 *           Which type of count should be used?
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

    try {
      // Filter by studyId by default
      const where: { [key: string]: any } = { studyId };
      if (countType === "all") {
        // Do nothing, retrieve all
      } else if (countType === "finished") {
        where.finished = true;
      } else {
        throw new Error(`Unknown countType: ${countType}`);
      }

      // TODO: Add caching or even a self-updating table or something to increase efficiency
      const count = await sequelize.models.Session.count({
        where,
      });

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

export { routerPublic };
