import type { Migration } from '../migrate';

import { DataTypes } from 'sequelize';

const columnComments = {
  participantId: `The unique identifier for each participant. This id is used to link runs with participants. Generated automatically.`,
}

export const up: Migration = async ({ context }) => {
  await context.changeColumn('wwl_runs', 'participantId', {
    type: DataTypes.UUID,
    allowNull: true,
    comment: columnComments.participantId,
  })
};
export const down: Migration = async ({ context }) => {
  await context.changeColumn('wwl_runs', 'participantId', {
    type: DataTypes.UUID,
    allowNull: false,
    comment: columnComments.participantId,
  })
};