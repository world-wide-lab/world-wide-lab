import 'dotenv/config';
import sequelize from './db';
import app from './app';

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

  // Start the server
  const port = process.env.PORT || 5000;
  return new Promise((resolve, reject) => {
    try {
      app.listen(port, () => {
        /* eslint-disable no-console */
        console.log(`Listening on: http://localhost:${port}`);
        console.log(`Admin UI at: http://localhost:${port}/admin`);
        console.log(`API Docs at: http://localhost:${port}/api-docs`);
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
