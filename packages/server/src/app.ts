import path from 'path'
import express, {Request, Response} from 'express';
import helmet from 'helmet';
import cors from 'cors';

import api from './api';
import apiDocs from './api-docs';
import { admin, adminRouter } from './admin'
import config from './config'
import { logger } from './logger'

const app = express();

// app.use(helmet());
app.use(cors());
app.use(express.json());

// Log all HTTP requests
if (config.logging.http) {
  logger.info(`Logging HTTP requests`)

  app.use((req, res, next) => {
    logger.http({
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      body: req.body,
      headers: req.headers,
    });
    next();
  });
}

app.use('/static', express.static(path.join(__dirname, '..', 'static')))

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
