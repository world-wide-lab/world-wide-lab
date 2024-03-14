import path from "path";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";

import { admin, adminRouter } from "./admin";
import api from "./api";
import apiDocs from "./api-docs";
import { routerProtectedWithoutAuthentication } from "./api/protected";
import config from "./config";
import { logger } from "./logger";

const app = express();

// app.use(helmet());
app.use(cors());
app.use(express.json());

// Log all HTTP requests
if (config.logging.http) {
  logger.info("Logging HTTP requests");

  app.use((req, res, next) => {
    logger.http(`${req.method} ${req.url} ${JSON.stringify(req.body)}`, {
      request: {
        query: req.query,
        params: req.params,
        body: req.body,
        headers: req.headers,
      },
    });
    next();
  });
}

app.use("/static", express.static(path.join(__dirname, "..", "static")));

app.get("/", async (req: Request, res: Response) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>World-Wide-Lab</title>
    </head>
    <body>
      World-Wide-Lab is running 🌐🧑‍🔬👩‍🔬👨‍🔬 <br />
      <ul>
        <li>The latest API can be found under <a href="/v1/">/v1/</a></li>
      </ul>
    </body>
  </html>
  `);
});

// Mount the API router under v1
app.use("/v1", api);

// Mount the api-docs
if (config.apiDocs.enabled) {
  app.use("/api-docs", apiDocs);
}

// Use adminJS
if (config.admin.enabled) {
  // Make protected API routes available in Admin UI
  adminRouter.use("/wwl/", routerProtectedWithoutAuthentication);

  app.use(admin.options.rootPath, adminRouter);
}

export default app;
