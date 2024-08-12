import type { Migration } from "../migrate.js";

import { DataTypes } from "sequelize";

export const up: Migration = async ({ context }) => {
  await context.createTable("wwl_deployments", {
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
      comment:
        "The timestamp this record has been created. Generated automatically.",
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: "CASCADE",
      comment:
        "The timestamp this record has last been updated or changed. Generated automatically.",
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
      comment: "The name of the deployment used to identify the pulumi stack.",
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
      comment:
        "Additional information for this record, stored as a JSON object.",
    },
  });
};
export const down: Migration = async ({ context }) => {
  await context.dropTable("wwl_deployments");
};
