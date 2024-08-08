import path from "node:path";
import { app } from "electron";

export const BASE_DIR = app.getPath("userData");
export const TEMP_DIR = app.getPath("temp");
const DATABASE_NAME = "world-wide-lab-database.sqlite";

// Set environment variables manually via JS
process.env.PORT = 8787;
process.env.WWL_ELECTRON_APP = "true";
process.env.ADMIN_UI = "true";
process.env.USE_AUTHENTICATION = "false";

export const loggingDir = path.join(BASE_DIR, "logs");
process.env.LOGGING_DIR = loggingDir;

// Don't try to bundle adminjs
process.env.ADMIN_JS_SKIP_BUNDLE = "true";

export const dbUrl = `sqlite:${path.join(BASE_DIR, DATABASE_NAME)}`;
process.env.DATABASE_URL = dbUrl;

// Manually set package version, which is normally set by npm
process.env.npm_package_version = app.getVersion();

process.env.DEFAULT_API_KEY = "wwl-electron";
