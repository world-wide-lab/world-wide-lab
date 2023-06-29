import { Sequelize, DataTypes } from 'sequelize';

function defineModels(sequelize: Sequelize) {

  const Study = sequelize.define('Study', {
    id : {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    studyId: {
      type: DataTypes.STRING,
      validate: {
        is: /^[a-zA-Z0-9-_]+$/,
      },
      unique: true,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CASCADE',
    },
    info: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'wwl_studies',
  });

  const Participant = sequelize.define('Participant', {
    participantId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CASCADE',
    },
    info: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'wwl_participants'
  });

  const Run = sequelize.define('Run', {
    runId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CASCADE',
    },
    info: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    finished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    participantId: {
      type: DataTypes.STRING,
    },
    studyId: {
      type: DataTypes.STRING,
    },
  }, {
    tableName: 'wwl_runs'
  });

  const Response = sequelize.define('Response', {
    responseId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CASCADE',
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

export default defineModels;
