// Set environment variables
import { adminJsTmpDir, dbUrl, loggingDir } from "./set-env.js";

import { init } from "@world-wide-lab/server/dist/init.js";
import { BrowserWindow, app, dialog, shell } from "electron";

import { existsSync, rmSync } from "node:fs";

// To prevent super slow start up
// via: https://stackoverflow.com/questions/55726947/electron-why-is-there-a-big-delay-when-loading-the-main-window-through-localho
app.commandLine.appendSwitch("auto-detect", "false");
app.commandLine.appendSwitch("no-proxy-server");

// Output important directory paths
console.log(`Logs Directory: "${loggingDir}"`);
console.log(`AdminJS Temp Directory: "${adminJsTmpDir}"`);
console.log(`Database URL: "${dbUrl}"`);

if (existsSync(adminJsTmpDir)) {
  console.log("Clearing AdminJS Temp Directory");
  rmSync(adminJsTmpDir, { recursive: true });
}

// Make sure that mainWindow isn't garbage collected
let mainWindow;
function createWindow(loadUrl = true) {
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 720,
    autoHideMenuBar: true,
    useContentSize: true,
    resizable: true,
  });
  // Open external links (i.e. target="_blank") in the external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  if (loadUrl) {
    openUrlInWindow();
  }
}

const url = `http://localhost:${process.env.PORT}/admin`;
function openUrlInWindow() {
  console.log(`Navigationg to: ${url}`);
  mainWindow.loadURL(url);
}

app.on("ready", async () => {
  try {
    // Start server
    await init();
  } catch (error) {
    console.error("Unhandled Error during Init: ", error);
    dialog.showErrorBox("Error", error.message);
    process.exit(1);
  }

  createWindow(true);
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(true);
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
