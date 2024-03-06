import path from "path";
import winston from "winston";
import config from "./config";

const customLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  sql: 3.5,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Maximum file size for file loggers
const maxsize = 2 * 1024 * 1024; // 5MB
// Maximum number of files to keep
const maxFiles = 3;

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
      level: config.logging.consoleLevel, // defaults to 'info'
    }),

    new winston.transports.File({
      filename: path.join(config.logging.dir, "default.log"),
      maxsize,
      maxFiles,
    }),
    new winston.transports.File({
      filename: path.join(config.logging.dir, "verbose.log"),
      level: "verbose",
      maxsize,
      maxFiles,
    }),
  ],
  levels: customLevels,
});

const log_sql = (message: string) => {
  // Log only the message itself to avoid additional clutter
  // Additional props are available, you can check these by modifying the props
  // above to function (...message: any[]) and logging that.
  logger.log("sql", message);
};

export { logger, log_sql };
