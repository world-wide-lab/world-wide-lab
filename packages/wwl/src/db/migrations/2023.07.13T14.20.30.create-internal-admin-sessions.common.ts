import type { Migration } from '../migrate';

import { DataTypes } from 'sequelize';

export const up: Migration = async ({ context }) => {
  context.createTable('wwl_internal_admin_sessions', {
    sid: {
      type: DataTypes.STRING(36),
      primaryKey: true
    },
    expires: DataTypes.DATE,
    data: DataTypes.TEXT,
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: 'CASCADE',
    },
  });
};
export const down: Migration = async ({ context }) => {
  context.dropTable('wwl_internal_admin_sessions');
};
