import type { Migration } from "../migrate.js";

import { DataTypes } from "sequelize";

const columnComments = {
  studyId:
    "The unique identifier for each study. This id is used to link sessions with studies. Must be unique across all studies.",
  sessionId:
    "The unique identifier for each session. This id is used to identify responses. Generated automatically.",

  createdAt:
    "The timestamp this record has been created. Generated automatically.",
  updatedAt:
    "The timestamp this record has last been updated or changed. Generated automatically.",
  extraInfo: "Additional information for this record, stored as a JSON object.",
  privateInfo:
    "Additional information for this record, stored as a JSON object.",
};

export const up: Migration = async ({ context }) => {
  await context.createTable("wwl_leaderboards", {
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
  });

  await context.addIndex("wwl_leaderboards", ["studyId"], {
    name: "idx_wwl_leaderboards_studyId",
  });

  await context.createTable("wwl_leaderboard_scores", {
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
  });

  // Many indices here to support sorting, joining, filtering and aggregating
  await context.addIndex("wwl_leaderboard_scores", ["leaderboardId"], {
    name: "idx_wwl_leaderboards_leaderboardId",
  });
  await context.addIndex("wwl_leaderboard_scores", ["sessionId"], {
    name: "idx_wwl_leaderboards_sessionId",
  });
  await context.addIndex("wwl_leaderboard_scores", ["score"], {
    name: "idx_wwl_leaderboards_score",
  });
  await context.addIndex("wwl_leaderboard_scores", ["publicIndividualName"], {
    name: "idx_wwl_leaderboards_publicIndividualName",
  });
  await context.addIndex("wwl_leaderboard_scores", ["publicGroupName"], {
    name: "idx_wwl_leaderboards_publicGroupName",
  });
};
export const down: Migration = async ({ context }) => {
  await context.dropTable("wwl_leaderboards");
  await context.dropTable("wwl_leaderboard_scores");
};
