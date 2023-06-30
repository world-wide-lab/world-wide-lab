import { Sequelize } from 'sequelize';

import defineModels from './models';
import config from '../config';

const sequelize = new Sequelize(
  config.database.url,
  {
    logging: console.log,
  }
);
defineModels(sequelize);

export default sequelize;
