import { Sequelize } from 'sequelize';

import { defineModels } from './models';
import config from '../config';
import { log_sql } from '../logger'

const sequelize = new Sequelize(
  config.database.url,
  {
    logging: log_sql,
  }
);
defineModels(sequelize);

export default sequelize;
