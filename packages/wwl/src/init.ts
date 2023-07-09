import sequelize from './db';
import app from './app';
import config from './config';
import { logger } from './logger';
import generateExampleData from './db/exampleData';

async function init() {
  logger.verbose(`Initializing with configuration`, { config });

  // Check the database
  logger.info(`Checking database connection...`);
	try {
		// Note: This can modify databases
    await sequelize.sync({alter: false});
    // or use instead sequelize.authenticate();
		logger.info(`Database connection OK!`);
	} catch (error) {
		logger.error(`Unable to connect to the database: ${(error as Error).message}`);
		process.exit(1);
	}

  if (config.database.generateExampleData) {
    await generateExampleData(sequelize);
  }

  // Start the server
  const root = config.root;
  const port = config.port;
  await new Promise((resolve, reject) => {
    try {
      app.listen(port, () => {
        logger.info(`Listening on: ${root}:${port}`);
        if (config.admin.enabled) {
          logger.info(`Admin UI at: ${root}:${port}/admin`);
        }
        if (config.apiDocs.enabled) {
          logger.info(`API Docs at: ${root}:${port}/api-docs`);
        }
        resolve(null)
      });
    } catch (error) {
      console.error(`Unable to launch express server: ${(error as Error).message}`);
		  reject(error);
    }
  });
}

export { init }
