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

  poolId:
    "The unique identifier and name for each pool of items. Must be unique across all pools.",
  itemId:
    "The unique identifier for each item. Generated automatically. This id is public, as it is handed out to participants.",
  drawId:
    "The unique identifier for each draw i.e. one item having been served to one session. Generated automatically. This id is public, as it is handed out to participants.",
  publicPayload:
    "The actual content of an item, stored as a JSON object. This field must not contain sensitive information, since it is shown to other participants via the public API.",
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
      drawId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        comment:
          "The draw this response was produced in reaction to, if any. This is what links a response back to the item a participant was shown.",
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

  const ItemPool = sequelize.define(
    "ItemPool",
    {
      poolId: {
        primaryKey: true,
        type: DataTypes.STRING,
        validate: {
          is: /^[a-zA-Z0-9-_]+$/,
        },
        unique: true,
        allowNull: false,
        defaultValue: null,
        comment: columnComments.poolId,
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
        comment: `${columnComments.studyId} If this is empty, the pool is shared across all studies.`,
      },
      moderation: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "reviewed",
        validate: {
          isIn: [["reviewed", "unreviewed", "closed"]],
        },
        comment:
          "How contributions to this pool are moderated. 'reviewed': anyone may contribute, but only approved items are shown to others. 'unreviewed': contributions are shown to others without anyone having approved them. 'closed': the pool does not accept contributions.",
      },
      maxPayloadBytes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          "The maximum size of an item's publicPayload in bytes. If this is empty, the server's default limit is used.",
      },
      publicInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.publicInfo,
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
    },
    {
      tableName: "wwl_item_pools",
    },
  );

  const Item = sequelize.define(
    "Item",
    {
      itemId: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        comment: columnComments.itemId,
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
      poolId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: columnComments.poolId,
      },
      publicPayload: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: columnComments.publicPayload,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: [["pending", "approved", "rejected", "retired"]],
        },
        comment:
          "The moderation status of this item. Whether an item is actually shown to other participants also depends on the moderation setting of its pool.",
      },
      sourceSessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        comment:
          "The session that contributed this item. If this is empty, the item has been seeded by the researcher.",
      },
      sourceResponseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: "The response this item has been generated from, if any.",
      },
      parentItemId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        comment:
          "The item this item has been generated from, if any. This is what links the individual steps of a transmission chain together.",
      },
      generation: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment:
          "How many items came before this one in its chain. Items without a parent are generation 0.",
      },
      timesDrawn: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment:
          "How often this item has been served to a session. Kept in sync with the number of draws for this item.",
      },
      timesCompleted: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment:
          "How often a session that was served this item has completed its draw.",
      },
      privateInfo: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: columnComments.privateInfo,
      },
    },
    {
      tableName: "wwl_items",
    },
  );

  const ItemDraw = sequelize.define(
    "ItemDraw",
    {
      drawId: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        comment: columnComments.drawId,
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
      itemId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: columnComments.itemId,
      },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: columnComments.sessionId,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "served",
        validate: {
          isIn: [["served", "completed"]],
        },
        comment:
          "Whether the session this item was served to has completed what it was drawn for.",
      },
    },
    {
      tableName: "wwl_item_draws",
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

  Study.hasMany(ItemPool, { sourceKey: "studyId", foreignKey: "studyId" });
  ItemPool.belongsTo(Study, { targetKey: "studyId", foreignKey: "studyId" });

  ItemPool.hasMany(Item, { foreignKey: "poolId" });
  Item.belongsTo(ItemPool, { foreignKey: "poolId" });

  Session.hasMany(Item, {
    as: "contributedItems",
    foreignKey: "sourceSessionId",
  });
  Item.belongsTo(Session, {
    as: "sourceSession",
    foreignKey: "sourceSessionId",
  });

  Response.hasMany(Item, {
    as: "generatedItems",
    foreignKey: "sourceResponseId",
  });
  Item.belongsTo(Response, {
    as: "sourceResponse",
    foreignKey: "sourceResponseId",
  });

  Item.hasMany(Item, { as: "childItems", foreignKey: "parentItemId" });
  Item.belongsTo(Item, { as: "parentItem", foreignKey: "parentItemId" });

  Item.hasMany(ItemDraw, { foreignKey: "itemId" });
  ItemDraw.belongsTo(Item, { foreignKey: "itemId" });

  Session.hasMany(ItemDraw, { foreignKey: "sessionId" });
  ItemDraw.belongsTo(Session, { foreignKey: "sessionId" });

  ItemDraw.hasMany(Response, { foreignKey: "drawId" });
  Response.belongsTo(ItemDraw, { foreignKey: "drawId" });

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
