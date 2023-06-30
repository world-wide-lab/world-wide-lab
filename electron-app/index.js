const { app, BrowserWindow } = require('electron')
const { init } = require('@world-wide-lab/wwl/dist/init.js')

app.on('ready', async function() {
  const initPromise = init()
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 720,
    autoHideMenuBar: true,
    useContentSize: true,
    resizable: true,
  });

  // Wait for express server to start
  await initPromise;
  mainWindow.loadURL(`http://localhost:${process.env.PORT}/admin`);
});
