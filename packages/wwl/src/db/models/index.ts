import { Sequelize, DataTypes } from 'sequelize';

const columnComments = {
  studyId: `The unique identifier for each study. This id is used to link runs with studies. Must be unique across all studies.`,
  participantId: `The unique identifier for each participant. This id is used to link runs with participants. Generated automatically.`,
  runId: `The unique identifier for each run. This id is used to identify responses. Generated automatically.`,
  responseId: `The unique identifier for each response. Generated automatically.`,

  createdAt: `The timestamp this record has been created. Generated automatically.`,
  updatedAt: `The timestamp this record has last been updated or changed. Generated automatically.`,
  info: `Additional information for this record, stored as a JSON object.`,
}

function defineModels(sequelize: Sequelize) {

  const Study = sequelize.define('Study', {
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
      onUpdate: 'CASCADE',
      comment: columnComments.updatedAt,
    },
    info: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.info,
    },
  }, {
    tableName: 'wwl_studies',
  });

  const Participant = sequelize.define('Participant', {
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
      onUpdate: 'CASCADE',
      comment: columnComments.updatedAt,
    },
    info: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.info,
    },
  }, {
    tableName: 'wwl_participants'
  });

  const Run = sequelize.define('Run', {
    runId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      comment: columnComments.runId,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: columnComments.createdAt,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CASCADE',
      comment: columnComments.updatedAt,
    },
    info: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.info,
    },
    finished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: `Has this run has been finished? Note, that this field only gets updated when the /run/finish API endpoint is called.`,
    },
    participantId: {
      type: DataTypes.STRING,
      comment: columnComments.participantId,
    },
    studyId: {
      type: DataTypes.STRING,
      comment: columnComments.studyId,
    },
  }, {
    tableName: 'wwl_runs'
  });

  const Response = sequelize.define('Response', {
    responseId : {
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
      onUpdate: 'CASCADE',
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
    runId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: columnComments.runId,
    },
  }, {
    tableName: 'wwl_responses'
  });

  // Associations
  Participant.hasMany(Run, { foreignKey: 'participantId' });
  Run.belongsTo(Participant, { foreignKey: 'participantId' });

  Study.hasMany(Run, { sourceKey: 'studyId', foreignKey: 'studyId' });
  Run.belongsTo(Study, { targetKey: 'studyId', foreignKey: 'studyId' });

  Run.hasMany(Response, { foreignKey: 'runId' });
  Response.belongsTo(Run, { foreignKey: 'runId' });
}

export {
  defineModels,
  columnComments,
};
