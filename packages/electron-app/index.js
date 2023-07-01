// Fake environment variables
process.env.PORT = 7700
process.env.ADMIN_UI = "true"
process.env.USE_AUTHENTICATION = "false"

const path = require('path')
const { app, BrowserWindow } = require('electron')
process.env.ADMIN_JS_TMP_DIR = path.join(app.getPath("userData"), "adminjs-tmp")
const dbUrl = "sqlite:" + path.join(app.getPath("userData"), "world-wide-lab-database.sqlite")
console.log("Database: "+ dbUrl)
process.env.DATABASE_URL = dbUrl
const { init } = require('@world-wide-lab/wwl/dist/init.js')

// To prevent super slow start up
// via: https://stackoverflow.com/questions/55726947/electron-why-is-there-a-big-delay-when-loading-the-main-window-through-localho
app.commandLine.appendSwitch('auto-detect', 'false');
app.commandLine.appendSwitch('no-proxy-server')

app.on('ready', async function() {
  const initPromise = init()
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 720,
    autoHideMenuBar: true,
    useContentSize: true,
    resizable: true,
  });
  await initPromise;
  const url = `http://localhost:${process.env.PORT}/admin`
  console.log(`Navigationg to: ${url}`)
  mainWindow.loadURL(url);
});
