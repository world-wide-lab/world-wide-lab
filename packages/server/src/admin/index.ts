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
import { viewLeaderboardScoresHandler } from "./handlers/leaderboard.js";
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
const deploymentResource =
  config.electronApp || process.env.NODE_ENV === "development"
    ? [
        {
          resource: sequelize.models.Deployment,
          options: {
            navigation: {
              name: null,
              icon: "UploadCloud",
            },
            sort: {
              sortBy: "updatedAt",
              direction: "desc",
            },
            actions: {
              new: {
                component: Components.DeploymentEditAction,
              },
              show: {
                component: Components.DeploymentShowAction,
              },
              edit: {
                isAccessible: true,
                component: Components.DeploymentEditAction,
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
              name: {
                description:
                  "The name of the deployment. This is used to identify it. DO NOT change this after deployment.",
              },
              status: {
                position: 1,
                isVisible: {
                  list: true,
                  filter: true,
                  show: true,
                  edit: false,
                },
                availableValues: [
                  { value: "undeployed", label: "Undeployed" },
                  { value: "deployed", label: "Deployed" },
                  { value: "error", label: "Error" },
                ],
              },
              type: {
                position: 2,
                description: "The cloud provider and type of deploymennt.",
                availableValues: [
                  { value: "aws_apprunner", label: "AWS: App Runner" },
                  {
                    value: "azure_containerapp",
                    label: "Azure: Container App",
                  },
                ],
              },
              stackConfig: {
                position: 3,
                description:
                  "The configuration of the deployment stack. Please note that changing anything in here after deployment can lead to issues with updating or destroying the deployment.",
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
                description:
                  "The configuration of the deployment itself. This includes the database credentials and other sensitive information. These values can be altered after deployment, but we recommend doing this only if strictly necessary.",
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

const instancesResource = config.instances.visible
  ? [
      {
        resource: sequelize.models.Instance,
        options: {
          navigation: {
            name: null,
            icon: "Server",
          },
          sort: {
            sortBy: "startTime",
            direction: "desc",
          },
          actions: {
            new: {
              isAccessible: false,
            },
            edit: {
              isAccessible: false,
            },
            delete: {
              isAccessible: false,
            },
          },
          properties: {
            instanceId: {
              isTitle: true,
              isVisible: { list: true, filter: true, show: true },
            },
            isPrimary: {
              isVisible: { list: true, filter: true, show: true },
              position: 1,
            },
            ipAddress: {
              isVisible: { list: true, filter: true, show: true },
            },
            hostname: {
              isVisible: { list: false, filter: true, show: true },
            },
            port: {
              isVisible: { list: false, filter: true, show: true },
            },
            startTime: {
              isVisible: { list: true, filter: true, show: true },
              position: 2,
            },
            lastHeartbeat: {
              isVisible: { list: true, filter: true, show: true },
            },
            metadata: {
              isVisible: { list: false, filter: false, show: true },
              components: {
                show: Components.ShowJsonProp,
              },
              description: "Additional information about the instance",
            },
            createdAt: {
              isVisible: { list: false, filter: true, show: true },
              description: columnComments.createdAt,
            },
            updatedAt: {
              isVisible: { list: false, filter: true, show: true },
              description: columnComments.updatedAt,
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
        sort: {
          sortBy: "updatedAt",
          direction: "desc",
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
        sort: {
          sortBy: "updatedAt",
          direction: "desc",
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
        sort: {
          sortBy: "updatedAt",
          direction: "desc",
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
        sort: {
          sortBy: "updatedAt",
          direction: "desc",
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
    {
      resource: sequelize.models.Leaderboard,
      options: {
        navigation: {
          name: null,
          icon: "TrendingUp",
        },

        properties: {
          leaderboardId: {
            isTitle: true,
            isVisible: { list: true, filter: true, show: true, edit: true },
          },

          studyId: {
            isVisible: { list: true, filter: true, show: true, edit: true },
            position: 1,
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
            isVisible: { list: false, filter: false, show: true, edit: true },
            components: {
              show: Components.ShowJsonProp,
              edit: Components.EditJsonProp,
            },
            description: columnComments.privateInfo,
          },
        },

        actions: {
          viewScores: {
            actionType: "record",
            component: false,
            icon: "Eye",
            handler: viewLeaderboardScoresHandler,
          },
        },
      },
    },
    {
      resource: sequelize.models.LeaderboardScore,
      options: {
        // Invisible in navigation
        navigation: false,

        actions: {
          new: {
            isAccessible: false,
          },
          edit: {
            isAccessible: false,
          },
        },
      },
    },

    ...deploymentResource,
    ...instancesResource,
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
          wwl_leaderboards: "Leaderboards",
          wwl_leaderboard_scores: "Leaderboard Scores",
          wwl_internal_instances: "Instances",
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
          wwl_internal_instances: {
            actions: {
              show: "View Instance Details",
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
