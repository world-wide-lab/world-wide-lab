import type { Server as HTTPServer } from "http";
import app from "./app";
import config from "./config";
import sequelize from "./db";
import generateExampleData from "./db/exampleData";
import { up } from "./db/migrate";
import { logger } from "./logger";

import { ensureStudiesExist } from "./db/ensureStudiesExist";

// Export Server type for convenience
export type Server = HTTPServer;

async function init(): Promise<HTTPServer> {
  logger.verbose("Initializing with configuration", { config });

  // Check the database
  try {
    logger.info("Checking database connection...");
    await sequelize.authenticate();
    logger.info("Database connection: OK");
  } catch (error) {
    logger.error(
      `Unable to connect to the database: ${(error as Error).message}`,
    );
    throw error;
  }
  try {
    logger.info("Checking for migrations...");
    await up();
    logger.info("Database migrations: OK");
  } catch (error) {
    logger.error(`Unable to apply migrations: ${(error as Error).message}`);
    throw error;
  }

  if (config.database.generateExampleData) {
    await generateExampleData(sequelize);
  }

  // Make sure that certain studies are available (based on env vars)
  if (config.studiesToCreate && config.studiesToCreate.length > 0) {
    await ensureStudiesExist(sequelize, config.studiesToCreate);
  }

  // Start the server
  const root = config.root;
  const configPort = config.port;
  return await new Promise((resolve, reject) => {
    try {
      const server = app.listen(configPort, () => {
        // Get assigned port from the operating system (if configPort == 0)
        const serverAdress = server.address();
        const port =
          serverAdress !== null && typeof serverAdress === "object"
            ? serverAdress.port
            : configPort;

        logger.info(`Listening on: ${root}:${port}`);
        if (config.admin.enabled) {
          logger.info(`Admin UI at: ${root}:${port}/admin`);
        }
        if (config.apiDocs.enabled) {
          logger.info(`API Docs at: ${root}:${port}/api-docs`);
        }
        resolve(server);
      });
    } catch (error) {
      console.error(
        `Unable to launch express server: ${(error as Error).message}`,
      );
      reject(error);
    }
  });
}

export { init };
