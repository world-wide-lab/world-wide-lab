import { DataTypes, type Sequelize } from "sequelize";

const columnComments = {
  studyId:
    "The unique identifier for each study. This id is used to link sessions with studies. Must be unique across all studies.",
  participantId:
    "The unique identifier for each participant. This id is used to link sessions with participants. Generated automatically.",
  sessionId:
    "The unique identifier for each session. This id is used to identify responses. Generated automatically.",
  responseId:
    "The unique identifier for each response. Generated automatically.",

  createdAt:
    "The timestamp this record has been created. Generated automatically.",
  updatedAt:
    "The timestamp this record has last been updated or changed. Generated automatically.",
  privateInfo:
    "Additional information for this record, stored as a JSON object.",
  publicInfo:
    "Additional public information for this record, stored as a JSON object. This field must not contain sensitive information as its contents can be queried from the public API.",
  deletionProtection:
    "Should the study be protected from deletion? If this is set to true, the study cannot be deleted from the admin interface until this is turned off again. This is useful to prevent accidental deletion of studies that have already been published.",
};

function defineModels(sequelize: Sequelize) {
  const Study = sequelize.define(
    "Study",
    {
      studyId: {
        primaryKey: true,
        type: DataTypes.STRING,
        validate: {
          is: /^[a-zA-Z0-9-_]+$/,
        },
        unique: true,
        allowNull: false,
        defaultValue: null,
        comment: columnComments.studyId,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
      publicInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.publicInfo,
      },
      deletionProtection: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: columnComments.deletionProtection,
      },
    },
    {
      tableName: "wwl_studies",
    },
  );

  const Participant = sequelize.define(
    "Participant",
    {
      participantId: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        comment: columnComments.participantId,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
      publicInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.publicInfo,
      },
    },
    {
      tableName: "wwl_participants",
    },
  );

  const Session = sequelize.define(
    "Session",
    {
      sessionId: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        comment: columnComments.sessionId,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
      publicInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.publicInfo,
      },
      finished: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment:
          "Has this session has been finished? Note, that this field only gets updated when the /session/finish API endpoint is called.",
      },
      participantId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: columnComments.participantId,
      },
      studyId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: columnComments.studyId,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: `Metadata for each session. Automatically filled by World-Wide-Lab, including information such as the server's version.`,
      },
    },
    {
      tableName: "wwl_sessions",
    },
  );

  const Response = sequelize.define(
    "Response",
    {
      responseId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: columnComments.responseId,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: columnComments.sessionId,
      },
    },
    {
      tableName: "wwl_responses",
    },
  );

  const Leaderboard = sequelize.define(
    "Leaderboard",
    {
      leaderboardId: {
        primaryKey: true,
        type: DataTypes.STRING,
        validate: {
          is: /^[a-zA-Z0-9-_]+$/,
        },
        unique: true,
        allowNull: false,
        defaultValue: null,
        comment: "The unique identifier and name for each leaderboard.",
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      studyId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        comment: columnComments.studyId,
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
    },
    {
      tableName: "wwl_leaderboards",
    },
  );

  const LeaderboardScore = sequelize.define(
    "LeaderboardScore",
    {
      leaderboardScoreId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: "The unique identifier for each score on the leaderboard.",
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      leaderboardId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment:
          "The unique identifier for the leaderboard this score belongs to.",
      },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: columnComments.sessionId,
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "The score that was achieved.",
      },
      publicIndividualName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment:
          "The individual name associated with the score (publicly visible).",
      },
      publicGroupName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment:
          "The group name associated with the score (publicly visible). This needs to match exactly, as it is used for aggregation.",
      },
    },
    {
      tableName: "wwl_leaderboard_scores",
    },
  );

  // Associations
  Participant.hasMany(Session, { foreignKey: "participantId" });
  Session.belongsTo(Participant, { foreignKey: "participantId" });

  Study.hasMany(Session, { sourceKey: "studyId", foreignKey: "studyId" });
  Session.belongsTo(Study, { targetKey: "studyId", foreignKey: "studyId" });

  Session.hasMany(Response, { foreignKey: "sessionId" });
  Response.belongsTo(Session, { foreignKey: "sessionId" });

  Study.hasMany(Leaderboard, { sourceKey: "studyId", foreignKey: "studyId" });
  Leaderboard.belongsTo(Study, { targetKey: "studyId", foreignKey: "studyId" });

  Leaderboard.hasMany(LeaderboardScore, { foreignKey: "leaderboardId" });
  LeaderboardScore.belongsTo(Leaderboard, { foreignKey: "leaderboardId" });

  Session.hasMany(LeaderboardScore, { foreignKey: "sessionId" });
  LeaderboardScore.belongsTo(Session, { foreignKey: "sessionId" });

  const InternalAdminSession = sequelize.define(
    "InternalAdminSession",
    {
      sid: {
        type: DataTypes.STRING(36),
        primaryKey: true,
      },
      expires: DataTypes.DATE,
      data: DataTypes.TEXT,
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
      },
    },
    {
      tableName: "wwl_internal_admin_sessions",
    },
  );

  const Deployment = sequelize.define(
    "Deployment",
    {
      deploymentId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        comment: "The unique identifier for each deployment.",
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "undeployed",
        comment: "The last status of the deployment.",
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Which type of deployment / provider.",
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment:
          "The name of the deployment used to identify the pulumi stack.",
      },
      stackConfig: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "The configuration for the pulumi stack (e.g. AWS region).",
      },
      deploymentConfig: {
        type: DataTypes.JSON,
        allowNull: true,
        comment:
          "The configuration for the deployment (e.g. env vars, passwords, memory).",
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
    },
    {
      tableName: "wwl_deployments",
    },
  );

  const Instance = sequelize.define(
    "Instance",
    {
      instanceId: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        comment: "Unique identifier for a particular instance",
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment:
          "Does this instance currently consider itself to be the primary instance?",
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "IP address of the instance",
      },
      hostname: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Hostname of the instance",
      },
      port: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Port the instance is running on",
      },
      startTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "When the instance started",
      },
      lastHeartbeat: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: "Last time the instance sent a heartbeat",
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Additional information about the instance",
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: columnComments.createdAt,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: "CASCADE",
        comment: columnComments.updatedAt,
      },
    },
    {
      tableName: "wwl_internal_instances",
    },
  );
}

export { defineModels, columnComments };
