const path = require('path')
const { app } = require('electron')

const BASE_DIR = app.getPath("userData")
const DATABASE_NAME = "world-wide-lab-database.sqlite"

// Set environment variables manually via JS
process.env.PORT = 8787
process.env.ADMIN_UI = "true"
process.env.USE_AUTHENTICATION = "false"

const adminJsTmpDir = path.join(BASE_DIR, "adminjs-tmp")
process.env.ADMIN_JS_TMP_DIR = adminJsTmpDir
console.log("AdminJS Temp Directory: " + adminJsTmpDir)

const dbUrl = "sqlite:" + path.join(BASE_DIR, DATABASE_NAME)
process.env.DATABASE_URL = dbUrl
console.log("Database URL: " + dbUrl)
