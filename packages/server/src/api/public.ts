import express, { Request, Response } from "express";
import sequelize from "../db";
import validator from 'validator';

const routerPublic = express.Router();

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
routerPublic.get('/', async (req: Request, res: Response) => {
  res.type('text').send('World-Wide-Lab API is running 🌐🧑‍🔬👩‍🔬👨‍🔬');
});

/**
 * @openapi
 * /participant:
 *   post:
 *     summary: Create a new participant
 *     tags:
 *       - main
 *     responses:
 *       '200':
 *         description: Participant created successfully
 *       '500':
 *         description: Failed to create participant
 */
routerPublic.post('/participant', async (req: Request, res: Response) => {
  try {
    const participant = await sequelize.models.Participant.create();
    res.json(participant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create participant' });
  }
});

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
routerPublic.put('/participant/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  const newData = req.body;
  try {
    if (!validator.isUUID(participantId)) {
      res.status(400).json({ error: 'participantId is not a valid UUID' });
      return
    }
    const updatedRows = await sequelize.models.Participant.update(newData, { where: { participantId } });
    if (updatedRows[0] == 1) {
      res.status(200).send({ success: true });
    } else {
      res.status(400).json({ error: 'Unknown participantId' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

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
 *         description: Run does not exist.
 *       '500':
 *         description: Failed to retrieve participant information.
 */
routerPublic.get('/participant/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  try {
    if (!validator.isUUID(participantId)) {
      res.status(400).json({ error: 'participantId is not a valid UUID' });
      return
    }
    const participant = await sequelize.models.Participant.findOne({
      where: { participantId },
      attributes: ['participantId', 'publicInfo']
    });
    if (participant) {
      res.status(200).json(participant.toJSON());
    } else {
      res.status(400).json({ error: 'Unknown participantId' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

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
 *             required:
 *               - studyId
 *     responses:
 *       '200':
 *         description: Study created successfully
 *       '500':
 *         description: Failed to create study
 */
routerPublic.post('/study', async (req: Request, res: Response) => {
  const { studyId } = req.body;
  try {
    const study = await sequelize.models.Study.create({ studyId });
    res.json(study);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create study' });
  }
});

/**
 * @openapi
 * /run:
 *   post:
 *     summary: Start a new run
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
 *             required:
 *               - studyId
 *     responses:
 *       '200':
 *         description: Run created successfully
 *       '400':
 *         description: Malformed request
 *       '500':
 *         description: Failed to create run
 */
routerPublic.post('/run', async (req: Request, res: Response) => {
  const { participantId, studyId } = req.body;
  try {
    const runData: {
      studyId: string,
      participantId?: string
    } = {
      studyId
    };

    // Check for participantId (optional)
    if (participantId !== undefined) {
      if (!validator.isUUID(participantId)) {
        res.status(400).json({ error: 'participantId is not a valid UUID' });
        return
      }
      runData.participantId = participantId;
    }

    if (studyId !== undefined) {
      const run = await sequelize.models.Run.create(runData);
      res.json(run);
    } else {
      res.status(400).json({ error: 'Missing participantId or studyId.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create run' });
  }
});

/**
 * @openapi
 * /run/finish:
 *   post:
 *     summary: Mark a run as finished
 *     tags:
 *       - main
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               runId:
 *                 type: string
 *             required:
 *               - runId
 *     responses:
 *       '200':
 *         description: Run marked as finished successfully
 *       '500':
 *         description: Failed to update run
 */
routerPublic.post('/run/finish', async (req: Request, res: Response) => {
  const { runId } = req.body;
  try {
    if (!validator.isUUID(runId)) {
      res.status(400).json({ error: 'runId is not a valid UUID' });
      return
    }
    const updatedRows = await sequelize.models.Run.update({ finished: true }, { where: { runId } });
    if (updatedRows[0] == 1) {
      res.status(200).send({ success: true });
    } else {
      res.status(400).json({ error: 'Unknown runId' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update run' });
  }
});

/**
 * @openapi
 * /run/{runId}:
 *   put:
 *     summary: Update a run
 *     tags:
 *       - update
 *     parameters:
 *       - in: path
 *         name: runId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the run to update
 *     requestBody:
 *       description: New data for the run
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
 *         description: Run updated successfully
 *       '500':
 *         description: Failed to update run
 */
routerPublic.put('/run/:runId', async (req: Request, res: Response) => {
  const { runId } = req.params;
  const newData = req.body;
  try {
    if (!validator.isUUID(runId)) {
      res.status(400).json({ error: 'runId is not a valid UUID' });
      return
    }
    const updatedRows = await sequelize.models.Run.update(newData, { where: { runId } });
    if (updatedRows[0] == 1) {
      res.status(200).send({ success: true });
    } else {
      res.status(400).json({ error: 'Unknown runId' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update run' });
  }
});

/**
 * @openapi
 * /run/{runId}:
 *   get:
 *     summary: Retrieve public information for a run
 *     tags:
 *       - public-info
 *     parameters:
 *       - in: path
 *         name: runId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the run to retrieve public information for.
 *     responses:
 *       '200':
 *         description: Public run information as JSON.
 *       '400':
 *         description: Run does not exist.
 *       '500':
 *         description: Failed to retrieve run information.
 */
routerPublic.get('/run/:runId', async (req: Request, res: Response) => {
  const { runId } = req.params;
  try {
    if (!validator.isUUID(runId)) {
      res.status(400).json({ error: 'runId is not a valid UUID' });
      return
    }
    const run = await sequelize.models.Run.findOne({
      where: { runId },
      attributes: ['runId', 'publicInfo']
    });
    if (run) {
      res.status(200).json(run.toJSON());
    } else {
      res.status(400).json({ error: 'Unknown runId' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update run' });
  }
});

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
 *               runId:
 *                 type: string
 *               name:
 *                 type: string
 *               payload:
 *                 type: object
 *             required:
 *               - runId
 *               - name
 *               - payload
 *     responses:
 *       '200':
 *         description: Response created successfully
 *       '400':
 *         description: Invalid request body, either misformatted or the runId does not exist
 *       '500':
 *         description: Failed to create response
 */
routerPublic.post('/response', async (req: Request, res: Response) => {
  const { runId, name, payload } = req.body;

  // Validate payload, it can be NULL (undefined) or a JSON object
  if (!(payload === null || payload === undefined || typeof payload === 'object')) {
    res.status(400).json({ error: 'Payload has to be a JSON object, undefined or null.' });
    return
  }
  if (!validator.isUUID(runId)) {
    res.status(400).json({ error: 'runId is not a valid UUID' });
    return
  }

  try {
    const response = await sequelize.models.Response.create({ runId, name, payload });
    res.json(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({ error: 'Unknown runId' });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Failed to create response' });
    }
  }
});

/**
 * @openapi
 * /study/{studyId}/count/{countFilter}:
 *   get:
 *     summary: Retrieve the number of runs for a study
 *     description: >
 *       This endpoint is used to count the number of runs for a study.
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
routerPublic.get('/study/:studyId/count/:countType', async (req: Request, res: Response) => {
  const { studyId, countType } = req.params;

  try {
    // Filter by studyId by default
    const where: {[key: string]: any} = { studyId };
    if (countType === "all") {
      // Do nothing, retrieve all
    } else if (countType === "finished") {
      where.finished = true
    } else {
      throw new Error(`Unknown countType: ${countType}`)
    }

    // TODO: Add caching or even a self-updating table or something to increase efficiency
    const count = await sequelize.models.Run.count({
      where,
    })

    // When the count is 0, check whether it may be due to the study not existing
    if (count === 0) {
      let study = await sequelize.models.Study.findOne({ where: { studyId } });
      if (!study) {
        res.status(400).json({ error: 'Unknown studyId' });
        return
      }
    }

    res.status(200).json({ count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve study count' });
  }
});

export { routerPublic };