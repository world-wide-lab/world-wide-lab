import express, { Request, Response } from "express";

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient();

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  res.send("API Running");
});

// Create new participant
router.post('/participant', async (req: Request, res: Response) => {
  const participant = await prisma.participant.create({ data: {} });
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

// Create new study
router.post('/study', async (req: Request, res: Response) => {
  const { studyId } = req.body;
  const studyInput: Prisma.StudyCreateInput = {
    studyId
  };
  const study = await prisma.study.create({
    data: studyInput,
  });
  res.json(study);
});

// Start a new run (payload: participantId & studyId)
router.post('/run', async (req: Request, res: Response) => {
  const { participantId, studyId } = req.body;
  const runInput: Prisma.RunCreateInput = {
    participant: {
      connect: { participantId },
    },
    study: {
      connect: { studyId },
    }
  }
  const run = await prisma.run.create({
    data: runInput,
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
  const runInput: Prisma.RunUpdateInput = newData;
  const run = await prisma.run.update({
    where: { runId },
    data: runInput,
  });
  res.json(run);
});

// Submit a response (payload: runId)
router.post('/response', async (req: Request, res: Response) => {
  const { runId } = req.params;
  const { name, payload } = req.body;

  const runInput: Prisma.ResponseCreateInput = {
    run: {
      connect: { runId },
    },
    name,
    // This depends on whether or not the DB supports string or JSON for payload
    payload: true ? JSON.stringify(payload) : payload,
  }

  const response = await prisma.response.create({
    data: runInput,
  });
  res.json(response);
});

export default router;
