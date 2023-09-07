import { Sequelize, Options as SequelizeOptions } from "sequelize";

import { defineModels } from "./models";
import config from "../config";
import { log_sql } from "../logger";

const url = config.database.url;
const options: SequelizeOptions = {
  logging: log_sql,
};

// There is a bug in handling filepaths with spaces when using sqlite via
// a URL string. Therefore we manually pass it the database URL for sqlite.
const isSqlite = url.startsWith("sqlite:");
if (isSqlite) {
  // Manually parse URL instead and add it to options
  options.dialect = "sqlite";
  options.storage = url.replace("sqlite://", "").replace("sqlite:", "");
}
const sequelize = isSqlite
  ? new Sequelize(options)
  : new Sequelize(url, options);

defineModels(sequelize);

export default sequelize;
