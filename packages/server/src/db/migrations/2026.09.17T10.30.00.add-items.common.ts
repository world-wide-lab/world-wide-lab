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
  privateInfo:
    "Additional information for this record, stored as a JSON object.",
  publicInfo:
    "Additional public information for this record, stored as a JSON object. This field must not contain sensitive information as its contents can be queried from the public API.",

  poolId:
    "The unique identifier and name for each pool of items. Must be unique across all pools.",
  itemId:
    "The unique identifier for each item. Generated automatically. This id is public, as it is handed out to participants.",
  drawId:
    "The unique identifier for each draw i.e. one item having been served to one session. Generated automatically. This id is public, as it is handed out to participants.",
  publicPayload:
    "The actual content of an item, stored as a JSON object. This field must not contain sensitive information, since it is shown to other participants via the public API.",
};

export const up: Migration = async ({ context }) => {
  // Pools of items, created by the researcher (mirrors wwl_leaderboards)
  await context.createTable("wwl_item_pools", {
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
      references: { model: "wwl_studies", key: "studyId" },
      comment: `${columnComments.studyId} If this is empty, the pool is shared across all studies.`,
    },
    moderation: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "reviewed",
      comment:
        "How contributions to this pool are moderated. 'reviewed': anyone may contribute, but only approved items are shown to others. 'unreviewed': contributions are shown to others without anyone having approved them. 'closed': the pool does not accept contributions.",
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
  });

  await context.addIndex("wwl_item_pools", ["studyId"], {
    name: "idx_wwl_item_pools_studyId",
  });

  // The items themselves, seeded by the researcher or contributed by participants
  await context.createTable("wwl_items", {
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
      references: { model: "wwl_item_pools", key: "poolId" },
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
      comment:
        "The moderation status of this item. Whether an item is actually shown to other participants also depends on the moderation setting of its pool.",
    },
    sourceSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: "wwl_sessions", key: "sessionId" },
      comment:
        "The session that contributed this item. If this is empty, the item has been seeded by the researcher.",
    },
    sourceResponseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: "wwl_responses", key: "responseId" },
      comment: "The response this item has been generated from, if any.",
    },
    parentItemId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: "wwl_items", key: "itemId" },
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
  });

  await context.addIndex("wwl_items", ["poolId"], {
    name: "idx_wwl_items_poolId",
  });
  await context.addIndex("wwl_items", ["status"], {
    name: "idx_wwl_items_status",
  });
  await context.addIndex("wwl_items", ["sourceSessionId"], {
    name: "idx_wwl_items_sourceSessionId",
  });
  await context.addIndex("wwl_items", ["parentItemId"], {
    name: "idx_wwl_items_parentItemId",
  });
  await context.addIndex("wwl_items", ["timesDrawn"], {
    name: "idx_wwl_items_timesDrawn",
  });
  await context.addIndex("wwl_items", ["updatedAt"], {
    name: "idx_wwl_items_updatedAt",
  });
  // Composite index for the hot query of drawing an item from a pool
  await context.addIndex("wwl_items", ["poolId", "status", "timesDrawn"], {
    name: "idx_wwl_items_poolId_status_timesDrawn",
  });

  // One row per "item has been served to session"
  await context.createTable("wwl_item_draws", {
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
      references: { model: "wwl_items", key: "itemId" },
      comment: columnComments.itemId,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "wwl_sessions", key: "sessionId" },
      comment: columnComments.sessionId,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "served",
      comment:
        "Whether the session this item was served to has completed what it was drawn for.",
    },
  });

  await context.addIndex("wwl_item_draws", ["itemId"], {
    name: "idx_wwl_item_draws_itemId",
  });
  await context.addIndex("wwl_item_draws", ["sessionId"], {
    name: "idx_wwl_item_draws_sessionId",
  });
  await context.addIndex("wwl_item_draws", ["status"], {
    name: "idx_wwl_item_draws_status",
  });
  // Composite index for filtering out items a session has already seen
  await context.addIndex("wwl_item_draws", ["sessionId", "itemId"], {
    name: "idx_wwl_item_draws_sessionId_itemId",
  });

  // Provenance: which draw a response has been produced in reaction to
  await context.addColumn("wwl_responses", "drawId", {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null,
    references: { model: "wwl_item_draws", key: "drawId" },
    comment:
      "The draw this response was produced in reaction to, if any. This is what links a response back to the item a participant was shown.",
  });

  await context.addIndex("wwl_responses", ["drawId"], {
    name: "idx_wwl_responses_drawId",
  });
};

export const down: Migration = async ({ context }) => {
  await context.removeIndex("wwl_responses", "idx_wwl_responses_drawId");
  await context.removeColumn("wwl_responses", "drawId");
  await context.dropTable("wwl_item_draws");
  await context.dropTable("wwl_items");
  await context.dropTable("wwl_item_pools");
};
