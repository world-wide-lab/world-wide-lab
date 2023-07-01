import 'dotenv/config';
import sequelize from './db';
import app from './app';
import config from './config';

import generateExampleData from './db/exampleData';

async function init() {
  // Check the database
  console.log(`Checking database connection...`);
	try {
		// Note: This can modify databases
    await sequelize.sync({alter: true});
    // or use instead sequelize.authenticate();
		console.log(`Database connection OK!`);
	} catch (error) {
		console.error(`Unable to connect to the database: ${(error as Error).message}`);
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
        /* eslint-disable no-console */
        console.log(`Listening on: ${root}:${port}`);
        if (config.admin.enabled) {
          console.log(`Admin UI at: ${root}:${port}/admin`);
        }
        if (config.apiDocs.enabled) {
          console.log(`API Docs at: ${root}:${port}/api-docs`);
        }
        /* eslint-enable no-console */
        resolve(null)
      });
    } catch (error) {
      console.error(`Unable to launch express server: ${(error as Error).message}`);
		  reject(error);
    }
  });
}

export { init }
