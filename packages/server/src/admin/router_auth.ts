import AdminJSExpress from "@adminjs/express";
import AdminJS from "adminjs";
import connect from "connect-session-sequelize";
import session from "express-session";

import config from "../config";
import sequelize from "../db";

const DEFAULT_ADMIN = config.admin.auth.default_admin_credentials;

// Check provided credentials to authenticate users
const authenticate = async (email: string, password: string) => {
  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    return Promise.resolve(DEFAULT_ADMIN);
  }
  return null;
};

function initializeRouter(admin: AdminJS) {
  if (!config.admin.auth.enabled) {
    // Don't use authentication
    const adminRouter = AdminJSExpress.buildRouter(admin);
    return adminRouter;
  }
  // Use authentication

  // Initialize session store
  const SequelizeStore = connect(session.Store);
  const sessionStore = new SequelizeStore({
    db: sequelize,
    table: "InternalAdminSession",
  });

  // Initialize router w/ authentication
  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: "adminjs",
      cookiePassword: config.admin.auth.sessionSecret as string,
    },
    null,
    {
      store: sessionStore,
      resave: true,
      saveUninitialized: true,
      secret: config.admin.auth.sessionSecret as string,
      cookie: {
        httpOnly: process.env.NODE_ENV === "production",
        secure: false,
      },
      proxy: true,
      name: "adminjs.sid",
    },
  );
  return adminRouter;
}

export { initializeRouter };
