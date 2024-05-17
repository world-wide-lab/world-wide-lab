import type { Migration } from "../migrate.js";

import { DataTypes } from "sequelize";

const columnComments = {
  deletionProtection:
    "Should the study be protected from deletion? If this is set to true, the study cannot be deleted from the admin interface until this is turned off again. This is useful to prevent accidental deletion of studies that have already been published.",
};

export const up: Migration = async ({ context }) => {
  await context.addColumn("wwl_studies", "deletionProtection", {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: columnComments.deletionProtection,
  });
};
export const down: Migration = async ({ context }) => {
  await context.removeColumn("wwl_studies", "deletionProtection");
};
