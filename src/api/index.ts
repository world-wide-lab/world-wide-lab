import express, { Request, Response } from "express";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  const items = ["item1", "item2", "item3"];
  res.send(items);
});

export default router;
