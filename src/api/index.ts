import express, { Request, Response } from "express";
import sequelize from "../db";

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  res.send('API Running');
});

// Create new participant
router.post('/participant', async (req: Request, res: Response) => {
  try {
    const participant = await sequelize.models.Participant.create();
    res.json(participant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create participant' });
  }
});

// Update an existing participant's data
router.put('/participant/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  const newData = req.body;
  try {
    const participant = await sequelize.models.Participant.update(newData, { where: { participantId } });
    res.json(participant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Create new study
router.post('/study', async (req: Request, res: Response) => {
  const { studyId } = req.body;
  try {
    const study = await sequelize.models.Study.create({ studyId });
    res.json(study);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create study' });
  }
});

// Start a new run (payload: participantId & studyId)
router.post('/run', async (req: Request, res: Response) => {
  const { participantId, studyId } = req.body;
  try {
    const run = await sequelize.models.Run.create({ participantId, studyId });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create run' });
  }
});

// Shorthand for marking a run as finished
router.post('/run/finish', async (req: Request, res: Response) => {
  const { runId } = req.body;
  try {
    const run = await sequelize.models.Run.update({ finished: true }, { where: { runId } });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update run' });
  }
});

// Update a run
router.put('/run/:runId', async (req: Request, res: Response) => {
  const { runId } = req.params;
  const newData = req.body;
  try {
    const run = await sequelize.models.Run.update(newData, { where: { runId } });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update run' });
  }
});

// Submit a response (payload: runId)
router.post('/response', async (req: Request, res: Response) => {
  const { runId, name, payload } = req.body;

  try {
    const response = await sequelize.models.Response.create({ runId, name, payload });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create response' });
  }
});

export default router;
