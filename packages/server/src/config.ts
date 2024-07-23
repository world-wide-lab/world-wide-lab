import { config as dotenvConfig } from "dotenv";
import { VERSION } from "./version.js";

function getValueFromEnv(key: string): string | undefined {
  const value = process.env[key];
  // This catches undefined, null and ""
  if (!value) {
    return undefined;
  }
  return value;
}

function getStringFromEnv(key: string): string;
function getStringFromEnv(
  key: string,
  defaultValue: string | undefined,
): string;
function getStringFromEnv(key: string, defaultValue: null): string | null;
function getStringFromEnv(
  key: string,
  defaultValue?: string | undefined | null,
) {
  const value = getValueFromEnv(key);
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`${key} must not be empty!`);
    }
    return defaultValue;
  }
  return value;
}

function getBooleanFromEnv(key: string, defaultValue = false): boolean {
  const value = getValueFromEnv(key);
  if (value === undefined) {
    return defaultValue;
  }
  const stringValue = value.toLowerCase();
  if (stringValue === "true") {
    return true;
  }
  if (stringValue === "false") {
    return false;
  }
  throw new Error(
    `Invalid value for ${key}: ${value}. Only "true" and "false" are supported.`,
  );
}

function getArrayFromEnv(key: string): string[] {
  const strValue = getValueFromEnv(key);
  if (strValue === undefined) return [];
  return strValue.split(",").map((s) => s.trim());
}

function getIntFromEnv(key: string): number | undefined {
  const strValue = getValueFromEnv(key);
  if (strValue === undefined) return undefined;
  return Number.parseInt(strValue);
}

// Load .env file
dotenvConfig({
  path: getValueFromEnv("WWL_ENV_FILE") || ".env",
});

const config = {
  root: getValueFromEnv("ROOT") || "http://localhost",
  port: getValueFromEnv("PORT") || 8787,

  version: VERSION,

  electronApp: getBooleanFromEnv("WWL_ELECTRON_APP", false),

  logging: {
    dir: getValueFromEnv("LOGGING_DIR") || "logs",
    // Change to 'verbose' to log SQL queries
    consoleLevel: getValueFromEnv("LOGGING_LEVEL_CONSOLE") || "info",
    http: getBooleanFromEnv("LOGGING_HTTP", true),
    sql: getBooleanFromEnv("LOGGING_SQL", true),
  },

  admin: {
    enabled: getBooleanFromEnv("ADMIN_UI", true),
    auth: {
      enabled: getBooleanFromEnv("USE_AUTHENTICATION", true),
      sessionSecret: getValueFromEnv("ADMIN_AUTH_SESSION_SECRET"),
      default_admin_credentials: {
        email: getValueFromEnv("ADMIN_AUTH_DEFAULT_EMAIL"),
        password: getValueFromEnv("ADMIN_AUTH_DEFAULT_PASSWORD"),
      },
    },
  },

  apiDocs: {
    enabled: getBooleanFromEnv("API_DOCS", true),
  },

  api: {
    apiKey: getValueFromEnv("DEFAULT_API_KEY"),
  },

  database: {
    url: getStringFromEnv("DATABASE_URL"),
    generateExampleData: getBooleanFromEnv("GENERATE_EXAMPLE_DATA", true),
    chunkSize: getIntFromEnv("DATABASE_CHUNK_SIZE") || 10000,
  },

  studiesToCreate: getArrayFromEnv("CREATE_STUDIES"),

  replication: {
    role: getStringFromEnv("REPLICATION_ROLE", null) as
      | "source"
      | "destination"
      | null,
    source: getStringFromEnv("REPLICATION_SOURCE", null),
    sourceApiKey: getStringFromEnv("REPLICATION_SOURCE_API_KEY", null),

    chunkSize: getIntFromEnv("REPLICATION_CHUNK_SIZE") || 50000,
  },
};

// Set config values based on other values
if (config.replication.role !== null) {
  if (config.replication.role === "source") {
    if (config.replication.source || config.replication.sourceApiKey) {
      throw new Error(
        `When REPLICATION_ROLE is set to "source", REPLICATION_SOURCE and REPLICATION_SOURCE_API_KEY must not be set.`,
      );
    }
  } else if (config.replication.role === "destination") {
    if (!config.replication.source || !config.replication.sourceApiKey) {
      throw new Error(
        `When REPLICATION_ROLE is set to "destination", REPLICATION_SOURCE and REPLICATION_SOURCE_API_KEY have to be set.`,
      );
    }
    if (config.replication.source.endsWith("/")) {
      console.warn('REPLICATION_SOURCE should not have a trailing slash. This may lead to unexpected errors.');
    }
    if (config.database.generateExampleData) {
      throw new Error(
        `When REPLICATION_ROLE is set to "destination", GENERATE_EXAMPLE_DATA must be set to 'false'.`,
      );
    }
  } else {
    throw new Error(
      `Invalid value for REPLICATION_ROLE: ${config.replication.role}. Only "source" and "destination" are supported.`,
    );
  }
}

// Validate configuration
if (config.admin.enabled && config.admin.auth.enabled) {
  if (
    !config.admin.auth.sessionSecret ||
    !config.admin.auth.default_admin_credentials.email ||
    !config.admin.auth.default_admin_credentials.password
  ) {
    throw new Error(
      "When authentication for Admin UI is enabled, credentials and session secret have to be set as well.",
    );
  }
}

export default config;
