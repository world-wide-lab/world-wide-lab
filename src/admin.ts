import AdminJS from 'adminjs'
import AdminJSExpress from '@adminjs/express'
import * as AdminJSSequelize from '@adminjs/sequelize'
import sequelize from './db'

AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
})

const databaseParent = {
  name: 'Database',
  icon: 'Folder',
}

const admin = new AdminJS({
  rootPath: '/admin',

  branding: {
    companyName: 'WWL: World-Wide-Lab ',
  },

  resources: [
    {
      resource: sequelize.models.Study,
      options: {
        parent: databaseParent,
        properties: {
          studyId: {
            isTitle: true,
            isVisible: { list: true, filter: true, show: true, edit: true },
          },
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
        }
      }
    },
    {
      resource: sequelize.models.Participant,
      options: {
        parent: databaseParent,
      }
    },
    {
      resource: sequelize.models.Run,
      options: {
        parent: databaseParent,
      }
    },
    {
      resource: sequelize.models.Response,
      options: {
        parent: databaseParent,
      }
    },
  ],

  locale: {
    translations: {
      labels: {
        wwl_studies: 'Studies',
        wwl_participants: 'Participants',
        wwl_runs: 'Runs',
        wwl_responses: 'Responses',
      }
    }
  },
})

const adminRouter = AdminJSExpress.buildRouter(admin)

// May or may not be needed
// https://docs.adminjs.co/installation/getting-started
admin.watch()

export {
  admin,
  adminRouter,
}
