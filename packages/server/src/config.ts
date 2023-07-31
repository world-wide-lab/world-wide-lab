import 'dotenv/config';

function getValueFromEnv(key: string): string | undefined {
  const value = process.env[key]
  // This catches undefined, null and ""
  if (!value) {
    return undefined
  } else {
    return value
  }
}

function getStringFromEnv(key: string): string {
  const value = getValueFromEnv(key)
  if (value === undefined) {
    throw new Error(`${key} must not be empty!`);
  }
  return value
}

function getBooleanFromEnv(key: string, defaultValue: boolean = false): boolean {
  const value = getValueFromEnv(key)
  if (value === undefined) {
    return defaultValue
  }
  const stringValue = value.toLowerCase()
  if (stringValue === "true") {
    return true
  } else if (stringValue === "false") {
    return false
  } else {
    throw new Error(`Invalid value for ${key}: ${value}. Only "true" and "false" are supported.`)
  }
}

const config = {
  root: getValueFromEnv("ROOT") || "http://localhost",
  port: getValueFromEnv("PORT") || 8787,

  version: process.env.npm_package_version as string,

  logging: {
    dir: getValueFromEnv("LOGGING_DIR") || "logs",
    // Change to 'verbose' to log SQL queries
    consoleLevel: getValueFromEnv("LOGGING_LEVEL_CONSOLE") || "info",
    http: getBooleanFromEnv("LOGGING_HTTP", true),
  },

  admin: {
    enabled: getBooleanFromEnv("ADMIN_UI", true),
    auth: {
      enabled: getBooleanFromEnv("USE_AUTHENTICATION", true),
      sessionSecret: getValueFromEnv("ADMIN_AUTH_SESSION_SECRET"),
      default_admin_credentials: {
        email: getValueFromEnv("ADMIN_AUTH_DEFAULT_EMAIL"),
        password: getValueFromEnv("ADMIN_AUTH_DEFAULT_PASSWORD")
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
  }
}

// Validate configuration
if (config.admin.enabled && config.admin.auth.enabled) {
  if (
    !config.admin.auth.sessionSecret ||
    !config.admin.auth.default_admin_credentials.email ||
    !config.admin.auth.default_admin_credentials.password
  ) {
    throw new Error(`When authentication for Admin UI is enabled, credentials and session secret have to be set as well.`)
  }
}

export default config