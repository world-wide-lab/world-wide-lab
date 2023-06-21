import express, { Request, Response } from "express";

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  res.send("API Running");
});

// Create new participant
router.post('/participant', async (req: Request, res: Response) => {
  const participant = await prisma.participant.create({ data: undefined });
  res.json(participant);
});

// Update an existing participant's data
router.put('/participant/:participantId', async (req: Request, res: Response) => {
  const { participantId } = req.params;
  const { newData } = req.body;
  const participant = await prisma.participant.update({
    where: { participantId },
    data: { newData },
  });
  res.json(participant);
});

// Start a new run (payload: participantId & studyId)
router.post('/run', async (req: Request, res: Response) => {
  const { participantId, studyId } = req.body;
  const run = await prisma.run.create({
    data: { participantId, studyId },
  });
  res.json(run);
});

// Shorthand for marking a run as finished
router.post('/run/finish', async (req: Request, res: Response) => {
  const { runId } = req.body;
  const run = await prisma.run.update({
    where: { runId },
    data: { finished: true },
  });
  res.json(run);
});

// Update a run
router.put('/run/:runId', async (req: Request, res: Response) => {
  const { runId } = req.params;
  const { newData } = req.body;
  const run = await prisma.run.update({
    where: { runId },
    data: { newData },
  });
  res.json(run);
});

// Submit a response (payload: runId)
router.post('/run/:runId/response', async (req: Request, res: Response) => {
  const { runId } = req.params;
  const { name, payload } = req.body;
  const response = await prisma.response.create({
    data: { runId, name, payload },
  });
  res.json(response);
});

export default router;
