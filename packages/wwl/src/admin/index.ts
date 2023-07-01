import AdminJS, { AdminPages, AdminPage } from 'adminjs'
import * as AdminJSSequelize from '@adminjs/sequelize'
import sequelize from '../db'
import { initializeRouter } from './router_auth'
import { componentLoader, Components } from './components'
import config from '../config'

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

const pages: AdminPages = {}
if (config.apiDocs.enabled) {
  pages['Public API'] = {
    component: Components.ApiDocsPage,
    icon: 'Book',
  } as AdminPage
}

const admin = new AdminJS({
  rootPath: '/admin',

  version: {
    admin: false,
    app: config.version,
  },
  branding: {
    companyName: 'World Wide Lab',
    logo: '/static/logo.svg',
    favicon: '/static/favicon.png',
    withMadeWithLove: false,
  },
  componentLoader,

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
  pages,

  locale: {
    language: 'en',
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

const adminRouter = initializeRouter(admin)

// Bundle admin js files in development mode
// Having this active will cause jest to stay open after tests are done
if (process.env.NODE_ENV === 'development') {
  admin.watch()
}

export {
  admin,
  adminRouter,
}
