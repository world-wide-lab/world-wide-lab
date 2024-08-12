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

// Add variables to the PATH so that they are found when exectuing commands (for deployments)
const currentPlatform = process.platform;
const pathSep = currentPlatform === "win32" ? ";" : ":";
const extraPaths = [
  { path: "/opt/homebrew/bin", platform: "darwin" },
  { path: "/opt/homebrew/sbin", platform: "darwin" },
  { path: "/usr/local/bin", platform: (p) => p !== "win32" },
];
for (const { path: pathToAdd, platform } of extraPaths) {
  // Check whether platform matches
  const addToPath =
    platform === "*" ||
    (typeof platform === "function"
      ? platform(currentPlatform)
      : platform === currentPlatform);

  if (addToPath) {
    // Check whether path is already present
    // Note: This is a bit extra conservative and will not detect a path
    // already being present at the end of the PATH.
    if (!process.env.PATH.includes(pathToAdd + pathSep)) {
      console.log(`Adding '${pathToAdd}' to PATH`);

      // Add extra path to the beginning of PATH
      process.env.PATH = `${pathToAdd}${pathSep}${process.env.PATH}`;
    }
  }
}
