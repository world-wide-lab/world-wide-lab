import type { Migration } from "../migrate";

import { DataTypes } from "sequelize";

const columnComments = {
  metadata: `Metadata for each session. Automatically filled by World-Wide-Lab, including information such as the server's version.`,
};

export const up: Migration = async ({ context }) => {
  await context.addColumn("wwl_sessions", "metadata", {
    type: DataTypes.JSON,
    allowNull: true,
    comment: columnComments.metadata,
  });
};
export const down: Migration = async ({ context }) => {
  await context.removeColumn("wwl_sessions", "metadata");
};
