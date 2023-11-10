import { Sequelize, DataTypes } from "sequelize";

const columnComments = {
  studyId: `The unique identifier for each study. This id is used to link sessions with studies. Must be unique across all studies.`,
  participantId: `The unique identifier for each participant. This id is used to link sessions with participants. Generated automatically.`,
  sessionId: `The unique identifier for each session. This id is used to identify responses. Generated automatically.`,
  responseId: `The unique identifier for each response. Generated automatically.`,

  createdAt: `The timestamp this record has been created. Generated automatically.`,
  updatedAt: `The timestamp this record has last been updated or changed. Generated automatically.`,
  privateInfo: `Additional information for this record, stored as a JSON object.`,
  publicInfo: `Additional public information for this record, stored as a JSON object. This field must not contain sensitive information as its contents can be queried from the public API.`,
  deletionProtection: `Should the study be protected from deletion? If this is set to true, the study cannot be deleted from the admin interface until this is turned off again. This is useful to prevent accidental deletion of studies that have already been published.`,
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
        comment: `Has this session has been finished? Note, that this field only gets updated when the /session/finish API endpoint is called.`,
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

  // Associations
  Participant.hasMany(Session, { foreignKey: "participantId" });
  Session.belongsTo(Participant, { foreignKey: "participantId" });

  Study.hasMany(Session, { sourceKey: "studyId", foreignKey: "studyId" });
  Session.belongsTo(Study, { targetKey: "studyId", foreignKey: "studyId" });

  Session.hasMany(Response, { foreignKey: "sessionId" });
  Response.belongsTo(Session, { foreignKey: "sessionId" });

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
}

export { defineModels, columnComments };
