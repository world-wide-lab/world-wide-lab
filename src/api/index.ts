import express, { Request, Response } from "express";
import sequelize from "../db";

const router = express.Router();

/**
 * @openapi
 * /:
 *   get:
 *     summary: Get API status
 *     responses:
 *       '200':
 *         description: API is running
 */
router.get('/', async (req: Request, res: Response) => {
  res.send('API Running');
});

/**
 * @openapi
 * /participant:
 *   post:
 *     summary: Create a new participant
 *     responses:
 *       '200':
 *         description: Participant created successfully
 *       '500':
 *         description: Failed to create participant
 */
router.post('/participant', async (req: Request, res: Response) => {
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
 *               info:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Participant updated successfully
 *       '500':
 *         description: Failed to update participant
 */
router.put('/participant/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  const newData = req.body;
  try {
    const updatedRows = await sequelize.models.Participant.update(newData, { where: { participantId } });
    if (updatedRows[0] == 1) {
      res.status(200).send();
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
router.post('/study', async (req: Request, res: Response) => {
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participantId:
 *                 type: string
 *               studyId:
 *                 type: string
 *             required:
 *               - participantId
 *               - studyId
 *     responses:
 *       '200':
 *         description: Run created successfully
 *       '500':
 *         description: Failed to create run
 */
router.post('/run', async (req: Request, res: Response) => {
  const { participantId, studyId } = req.body;
  try {
    const run = await sequelize.models.Run.create({ participantId, studyId });
    res.json(run);
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
router.post('/run/finish', async (req: Request, res: Response) => {
  const { runId } = req.body;
  try {
    const updatedRows = await sequelize.models.Run.update({ finished: true }, { where: { runId } });
    if (updatedRows[0] == 1) {
      res.status(200).send();
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
 *               info:
 *                 type: object
 *     responses:
 *       '200':
 *         description: Run updated successfully
 *       '500':
 *         description: Failed to update run
 */
router.put('/run/:runId', async (req: Request, res: Response) => {
  const { runId } = req.params;
  const newData = req.body;
  try {
    const updatedRows = await sequelize.models.Run.update(newData, { where: { runId } });
    if (updatedRows[0] == 1) {
      res.status(200).send();
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
 *       '500':
 *         description: Failed to create response
 */
router.post('/response', async (req: Request, res: Response) => {
  const { runId, name, payload } = req.body;

  try {
    const response = await sequelize.models.Response.create({ runId, name, payload });
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create response' });
  }
});

export default router;
