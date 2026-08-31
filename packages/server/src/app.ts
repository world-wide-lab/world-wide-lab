import path from "node:path";
import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";

import api from "./api/index.js";
import { routerProtectedWithoutAuthentication } from "./api/protected.js";
import config from "./config.js";
import { errorHandler } from "./errors.js";
import { logger } from "./logger.js";
import { getDirectory } from "./util.js";

const dirname = getDirectory(import.meta.url);

const app = express();

// app.use(helmet());
app.use(cors());
app.use(express.json({ limit: config.requestMaxSize }));

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

app.use("/static", express.static(path.join(dirname, "..", "static")));

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
// Generating the OpenAPI spec parses the annotated source files, so this is
// only imported when the docs are actually served.
if (config.apiDocs.enabled) {
  const { default: apiDocs } = await import("./api-docs/index.js");

  app.use("/api-docs", apiDocs);
}

// Use adminJS
// The admin UI pulls in AdminJS and its React components, which is by far the
// most expensive import of the whole server. Loading it lazily keeps startup
// (and the test suite, which runs with ADMIN_UI=false) fast when it is not
// needed.
if (config.admin.enabled) {
  const { admin, adminRouter } = await import("./admin/index.js");

  // Make protected API routes available in Admin UI
  adminRouter.use("/wwl/", routerProtectedWithoutAuthentication);

  app.use(admin.options.rootPath, adminRouter);
}

// Implement proper error handling
app.use(errorHandler);

export default app;
