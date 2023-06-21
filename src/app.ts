import 'dotenv/config';
import express, {Request, Response} from 'express';
import helmet from 'helmet';
import cors from 'cors';

import api from './api';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
  res.redirect("/v1/");
});

// Mount the API router under v1
app.use('/v1', api);

export default app;
