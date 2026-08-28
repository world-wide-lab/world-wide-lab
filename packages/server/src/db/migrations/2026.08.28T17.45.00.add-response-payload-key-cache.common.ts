import { DataTypes } from "sequelize";
import type { Migration } from "../migrate.js";

export const up: Migration = async ({ context }) => {
  await context.createTable("wwl_internal_response_payload_keys", {
    studyId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      comment: "The study the cached payload keys belong to.",
      references: { model: "wwl_studies", key: "studyId" },
      onDelete: "CASCADE",
    },
    keys: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment:
        "The keys that have been found in the payloads of the study's responses, together with the date of the most recent response each key appeared in.",
    },
    lastResponseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment:
        "The highest responseId that has already been scanned for keys. Responses after it still have to be scanned.",
    },
    lastUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment:
        "The most recent updatedAt among the responses that have already been scanned for keys. Responses changed after it have to be scanned again.",
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
  await context.dropTable("wwl_internal_response_payload_keys");
};
