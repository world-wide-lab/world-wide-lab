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

const infoDescription = (
  "JSON object with meta information." +
  "Use this to store any additional information you want to keep track of."
)

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
            description: 'Unique identifier for this particular study.',
            isVisible: { list: true, filter: true, show: true, edit: true },
          },
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          info: {
            description: infoDescription,
          },
        }
      }
    },
    {
      resource: sequelize.models.Participant,
      options: {
        parent: databaseParent,
        properties: {
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          info: {
            description: infoDescription,
          },
        }
      }
    },
    {
      resource: sequelize.models.Run,
      options: {
        parent: databaseParent,
        properties: {
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          info: {
            description: infoDescription,
          },
        }
      }
    },
    {
      resource: sequelize.models.Response,
      options: {
        parent: databaseParent,
        properties: {
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          info: {
            description: infoDescription,
          },
        }
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

// Bundle admin js files in development mode
// Having this active will cause jest to stay open after tests are done
if (process.env.NODE_ENV === 'development') {
  admin.watch()
}

export {
  admin,
  adminRouter,
}
