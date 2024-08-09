import {
  Database as SequelizeDatabase,
  Resource as SequelizeResource,
} from "@adminjs/sequelize";
import AdminJS, { type AdminPages, type AdminPage } from "adminjs";
import config from "../config.js";
import sequelize from "../db/index.js";
import { columnComments } from "../db/models/index.js";
import { Components, componentLoader } from "./components/index.js";
import { dashboardHandler } from "./handlers/dashboard.js";
import { deployDeploymentHandler } from "./handlers/deployment.js";
import { viewSessionHandler } from "./handlers/session.js";
import {
  deleteStudyHandler,
  downloadStudyDataHandler,
  newStudyHandler,
} from "./handlers/study.js";
import { randomString } from "./helpers.js";
import { initializeRouter } from "./router_auth.js";

AdminJS.registerAdapter({
  Resource: SequelizeResource,
  Database: SequelizeDatabase,
});

const pages: AdminPages = {};
if (config.apiDocs.enabled) {
  pages["Public API"] = {
    component: Components.ApiDocsPage,
    icon: "Book",
    handler: async (request, response, context) => {
      return {
        apiKey: config.api.apiKey,
      };
    },
  } as AdminPage;
}

// Deployments (only on electron)
const deploymentResource = config.electronApp
  ? [
      {
        resource: sequelize.models.Deployment,
        options: {
          navigation: {
            name: null,
            icon: "UploadCloud",
          },
          actions: {
            new: {},
            show: {
              component: Components.DeploymentShowAction,
            },
            edit: {
              isAccessible: false,
            },
            delete: {
              isAccessible: true,
            },
            deploy: {
              actionType: "record",
              component: false,
              isVisible: false,
              handler: deployDeploymentHandler,
            },
          },
          properties: {
            createdAt: {
              isVisible: {
                list: true,
                filter: true,
                show: true,
                edit: false,
              },
              description: columnComments.createdAt,
            },
            updatedAt: {
              isVisible: {
                list: true,
                filter: true,
                show: true,
                edit: false,
              },
              description: columnComments.updatedAt,
            },
            status: {
              position: 1,
              isVisible: {
                list: true,
                filter: true,
                show: true,
                edit: false,
              },
            },
            type: {
              position: 2,
              availableValues: [
                { value: "aws_apprunner", label: "AWS: App Runner" },
              ],
            },
            stackConfig: {
              position: 3,
              custom: {
                defaultValue: ["{", '  "awsRegion": "us-east-1"', "}"].join(
                  "\n",
                ),
              },
              components: {
                show: Components.ShowJsonProp,
                edit: Components.EditJsonProp,
              },

              isVisible: {
                list: false,
                filter: false,
                show: true,
                edit: true,
              },
            },
            deploymentConfig: {
              position: 5,
              custom: {
                defaultValue: [
                  "{",
                  `  "secret_dbUsername": "user_${randomString(6)}",`,
                  `  "secret_dbPassword": "${randomString(20)}",`,
                  `  "secret_wwlAdminAuthDefaultEmail": "hello_${randomString(
                    6,
                  )}@example.com",`,
                  `  "secret_wwlAdminAuthDefaultPassword": "${randomString(
                    20,
                  )}",`,
                  `  "secret_wwlAdminAuthSessionSecret": "${randomString(
                    20,
                  )}",`,
                  `  "secret_wwlDefaultApiKey": "${randomString(20)}"`,
                  "}",
                ].join("\n"),
              },
              components: {
                show: Components.ShowJsonProp,
                edit: Components.EditJsonProp,
              },

              isVisible: {
                list: false,
                filter: false,
                show: true,
                edit: true,
              },
            },
            privateInfo: {
              custom: {
                defaultValue: "{}",
              },
              isVisible: {
                list: false,
                filter: false,
                show: true,
                edit: true,
              },
              components: {
                show: Components.ShowJsonProp,
                edit: Components.EditJsonProp,
              },
              description: columnComments.privateInfo,
            },
          },
        },
      },
    ]
  : [];

const electronOnlySettings = {
  // Use pre-built adminjs assets in electron app
  assetsCDN: `${config.root}:${config.port}/static/adminjs/`,
};

const admin = new AdminJS({
  rootPath: "/admin",

  version: {
    admin: false,
    app: config.version,
  },
  branding: {
    companyName: "World-Wide-Lab",
    logo: config.electronApp
      ? "/static/logo-app.svg"
      : "/static/logo-server.svg",
    favicon: "/static/favicon.png",
    withMadeWithLove: false,
  },
  componentLoader,
  dashboard: {
    component: Components.Dashboard,
    handler: dashboardHandler,
  },

  resources: [
    {
      resource: sequelize.models.Study,
      options: {
        navigation: {
          name: null,
          icon: "Star",
        },
        properties: {
          studyId: {
            isTitle: true,
            isVisible: { list: true, filter: true, show: true, edit: true },
            description: columnComments.studyId,
          },
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.createdAt,
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.updatedAt,
          },
          privateInfo: {
            description: columnComments.privateInfo,
          },
          publicInfo: {
            description: columnComments.publicInfo,
          },
        },
        actions: {
          new: {
            handler: newStudyHandler,
          },
          delete: {
            handler: deleteStudyHandler,
          },
          show: {
            component: Components.StudyShowAction,
          },
          downloadData: {
            actionType: "record",
            label: "Download Data",
            icon: "Download",
            handler: downloadStudyDataHandler,
            component: Components.StudyDownloadAction,
          },
        },
      },
    },
    {
      resource: sequelize.models.Participant,
      options: {
        navigation: {
          name: null,
          icon: "Users",
        },
        actions: {
          new: {
            isAccessible: false,
          },
        },
        properties: {
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.createdAt,
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.updatedAt,
          },
          privateInfo: {
            isVisible: { list: false, filter: false, show: true, edit: false },
            components: {
              show: Components.ShowJsonProp,
            },
            description: columnComments.privateInfo,
          },
          publicInfo: {
            isVisible: { list: false, filter: false, show: true, edit: false },
            components: {
              show: Components.ShowJsonProp,
            },
            description: columnComments.publicInfo,
          },
        },
      },
    },
    {
      resource: sequelize.models.Session,
      options: {
        navigation: {
          name: null,
          icon: "Archive",
        },
        actions: {
          new: {
            isAccessible: false,
          },
          edit: {
            isAccessible: false,
          },
          viewResponses: {
            actionType: "record",
            component: false,
            icon: "Eye",
            handler: viewSessionHandler,
          },
        },
        properties: {
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.createdAt,
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.updatedAt,
          },
          privateInfo: {
            isVisible: { list: false, filter: false, show: true, edit: false },
            components: {
              show: Components.ShowJsonProp,
            },
            description: columnComments.privateInfo,
          },
          publicInfo: {
            isVisible: { list: false, filter: false, show: true, edit: false },
            components: {
              show: Components.ShowJsonProp,
            },
            description: columnComments.publicInfo,
          },
          metadata: {
            isVisible: { list: false, filter: false, show: true, edit: false },
            components: {
              show: Components.ShowJsonProp,
            },
          },
        },
      },
    },
    {
      resource: sequelize.models.Response,
      options: {
        navigation: {
          name: null,
          icon: "File",
        },
        actions: {
          new: {
            isAccessible: false,
          },
          edit: {
            isAccessible: false,
          },
        },
        properties: {
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.createdAt,
          },
          updatedAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
            description: columnComments.updatedAt,
          },
          payload: {
            isVisible: { list: false, filter: false, show: true, edit: true },
            components: {
              show: Components.ShowJsonProp,
              edit: Components.ShowJsonProp,
            },
            description:
              "The actual data stored in the response as a JSON object. Read-only.",
          },
        },
      },
    },

    ...deploymentResource,
  ],
  pages,

  locale: {
    language: "en",
    translations: {
      en: {
        components: {
          Login: {
            welcomeMessage:
              "to World-Wide-Lab, the open-source platform for running online experiments with a focus on large-scale citizen science.",
          },
        },
        labels: {
          wwl_studies: "Studies",
          wwl_participants: "Participants",
          wwl_sessions: "Sessions",
          wwl_responses: "Responses",
          wwl_deployments: "Deployments",
        },
        resources: {
          wwl_studies: {
            actions: {
              new: "Create New Study",
              show: "Study Info",
              edit: "Edit Study",
              delete: "Delete Study",
            },
          },
          wwl_participants: {
            actions: {
              show: "Participant Info",
              edit: "Edit Participant",
              delete: "Delete Participant",
            },
          },
          wwl_sessions: {
            actions: {
              show: "Session Info",
              edit: "Edit Session",
              delete: "Delete Session",
            },
          },
          wwl_responses: {
            actions: {
              show: "View Response",
            },
          },
          wwl_deployments: {
            actions: {
              new: "Create New Deployment",
              show: "Manage Deployment",
            },
          },
        },
      },
    },
  },

  // Merge in electron settings
  ...(config.electronApp ? electronOnlySettings : {}),
});

const adminRouter = initializeRouter(admin);

// Bundle admin js files in development mode
// Having this active will cause jest to stay open after tests are done
if (process.env.NODE_ENV === "development") {
  admin.watch();
}

export { admin, adminRouter };
