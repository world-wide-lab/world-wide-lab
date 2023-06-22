import { Sequelize } from 'sequelize';

import defineModels from './models';

const sequelize = new Sequelize(
  process.env.DATABASE_URL as string,
  {
    logging: console.log,
  }
);
defineModels(sequelize);

export default sequelize;
