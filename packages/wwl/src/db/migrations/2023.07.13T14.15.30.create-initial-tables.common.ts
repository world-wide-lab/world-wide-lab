import type { Migration } from '../migrate';

import { DataTypes } from 'sequelize';

const columnComments = {
  studyId: `The unique identifier for each study. This id is used to link runs with studies. Must be unique across all studies.`,
  participantId: `The unique identifier for each participant. This id is used to link runs with participants. Generated automatically.`,
  runId: `The unique identifier for each run. This id is used to identify responses. Generated automatically.`,
  responseId: `The unique identifier for each response. Generated automatically.`,

  createdAt: `The timestamp this record has been created. Generated automatically.`,
  updatedAt: `The timestamp this record has last been updated or changed. Generated automatically.`,
  extraInfo: `Additional information for this record, stored as a JSON object.`,
  publicInfo: `Additional public information for this record, stored as a JSON object. This field must not contain sensitive information as its contents can be queried from the public API.`,
}

export const up: Migration = async ({ context }) => {
  context.createTable('wwl_studies', {
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
    extraInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.extraInfo,
    },
    publicInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.publicInfo,
    },
  });

  context.createTable('wwl_participants', {
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
    extraInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.extraInfo,
    },
    publicInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.publicInfo,
    },
  });

  context.createTable('wwl_runs', {
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
    extraInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.extraInfo,
    },
    publicInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: columnComments.publicInfo,
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
  });

  context.createTable('wwl_responses', {
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
  });
};
export const down: Migration = async ({ context }) => {
  context.dropTable('wwl_studies');
  context.dropTable('wwl_participants');
  context.dropTable('wwl_runs');
  context.dropTable('wwl_responses');
};