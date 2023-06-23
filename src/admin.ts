import AdminJS from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import * as AdminJSSequelize from '@adminjs/sequelize'
import sequelize from './db'

AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
})

const admin = new AdminJS({
  rootPath: '/admin',

  branding: {
    companyName: 'WWL: World-Wide-Lab ',
  },

  resources: [
    sequelize.models.Study,
    sequelize.models.Participant,
    sequelize.models.Run,
    sequelize.models.Response,
  ],
})

const adminRouter = AdminJSExpress.buildRouter(admin)

// May or may not be needed
// https://docs.adminjs.co/installation/getting-started
admin.watch()

export {
  admin,
  adminRouter,
}
