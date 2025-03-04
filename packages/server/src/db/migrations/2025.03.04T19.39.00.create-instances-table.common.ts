import { DataTypes } from "sequelize";
import type { Migration } from "../migrate.js";

export const up: Migration = async ({ context }) => {
  await context.createTable("wwl_internal_instances", {
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
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: "CASCADE",
    },
  });
};

export const down: Migration = async ({ context }) => {
  await context.dropTable("wwl_internal_instances");
};
