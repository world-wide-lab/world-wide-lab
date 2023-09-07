// Set environment variables
require("./set-env");

const { app, BrowserWindow } = require("electron");
const { init } = require("@world-wide-lab/server/dist/init.js");

// To prevent super slow start up
// via: https://stackoverflow.com/questions/55726947/electron-why-is-there-a-big-delay-when-loading-the-main-window-through-localho
app.commandLine.appendSwitch("auto-detect", "false");
app.commandLine.appendSwitch("no-proxy-server");

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
  if (loadUrl) {
    openUrlInWindow();
  }
}

const url = `http://localhost:${process.env.PORT}/admin`;
function openUrlInWindow() {
  console.log(`Navigationg to: ${url}`);
  mainWindow.loadURL(url);
}

app.on("ready", async function () {
  // Start server
  await init();

  createWindow(true);
});

app.on("activate", function () {
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
