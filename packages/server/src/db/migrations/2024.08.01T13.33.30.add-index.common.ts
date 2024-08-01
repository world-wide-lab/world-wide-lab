import type { Migration } from "../migrate.js";

export const up: Migration = async ({ context }) => {
  // Add indices for joins during exports
  await context.addIndex("wwl_sessions", ["participantId"], {
    name: "idx_wwl_sessions_participantId",
  });

  // Add index for replications
  await context.addIndex("wwl_sessions", ["createdAt"], {
    name: "idx_wwl_sessions_createdAt",
  });
};

export const down: Migration = async ({ context }) => {
  await context.removeIndex("wwl_sessions", "idx_wwl_sessions_participantId");
  await context.removeIndex("wwl_sessions", "idx_wwl_sessions_createdAt");
};
