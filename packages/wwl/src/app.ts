import express, {Request, Response} from 'express';
import helmet from 'helmet';
import cors from 'cors';

import api from './api';
import apiDocs from './api-docs';
import { admin, adminRouter } from './admin'
import config from './config'

const app = express();

// app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/", async (req: Request, res: Response) => {
  res.redirect("/v1/");
});

// Mount the API router under v1
app.use('/v1', api);

// Mount the api-docs
if (config.apiDocs.enabled) {
  app.use('/api-docs', apiDocs);
}

// Use adminJS
if (config.admin.enabled) {
  app.use(admin.options.rootPath, adminRouter)
}

export default app;
