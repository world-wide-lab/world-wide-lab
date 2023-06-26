import AdminJS from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import session from 'express-session'
import connect from 'connect-session-sequelize'

import sequelize from '../db'

// Get configuration from environment variables
const USE_AUTHENTICATION = String(process.env.ADMIN_AUTH_ENABLED).toLowerCase() !== 'false'
const DEFAULT_ADMIN = {
  email: process.env.ADMIN_AUTH_DEFAULT_USERNAME,
  password: process.env.ADMIN_AUTH_DEFAULT_PASSWORD,
}
const SESSION_SECRET = process.env.ADMIN_AUTH_SESSION_SECRET
if (USE_AUTHENTICATION) {
  if (DEFAULT_ADMIN.email == "" || DEFAULT_ADMIN.password == "" || SESSION_SECRET == "") {
    throw new Error(
      "With ADMIN_AUTH_ENABLED = true, ADMIN_AUTH_DEFAULT_USERNAME," +
      "ADMIN_AUTH_DEFAULT_PASSWORD and ADMIN_AUTH_SESSION_SECRET must not be empty."
    );
  }
}

// Check provided credentials to authenticate users
const authenticate = async (email: string, password: string) => {
  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    return Promise.resolve(DEFAULT_ADMIN)
  }
  return null
}

function initializeRouter(admin: AdminJS) {
  if (!USE_AUTHENTICATION) {
    // Don't use authentication
    const adminRouter =  AdminJSExpress.buildRouter(admin)
    return adminRouter
  } else {
    // Use authentication

    // Initialize session store
    const SequelizeStore = connect(session.Store)
    const sessionStore = new SequelizeStore({
      db: sequelize,
      modelKey: 'AdminSession',
      tableName: 'wwl_admin_sessions',
    })

    // Initialize router w/ authentication
    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
      admin,
      {
        authenticate,
        cookieName: 'adminjs',
        cookiePassword: SESSION_SECRET,
      },
      null,
      {
        store: sessionStore,
        resave: true,
        saveUninitialized: true,
        secret: SESSION_SECRET,
        cookie: {
          httpOnly: process.env.NODE_ENV === 'production',
          secure: process.env.NODE_ENV === 'production',
        },
        proxy: true,
        name: 'adminjs.sid',
      }
    )
    return adminRouter
  }
}

export {
  initializeRouter,
}
