import type { Migration } from "../migrate.js";

export const up: Migration = async ({ context }) => {
  // Add indices for joins during exports
  await context.addIndex("wwl_sessions", ["studyId"], {
    name: "idx_wwl_sessions_studyId",
  });
  await context.addIndex("wwl_responses", ["sessionId"], {
    name: "idx_wwl_responses_sessionId",
  });

  // Add index for replications
  await context.addIndex("wwl_responses", ["updatedAt"], {
    name: "idx_wwl_responses_updatedAt",
  });
  await context.addIndex("wwl_sessions", ["updatedAt"], {
    name: "idx_wwl_sessions_updatedAt",
  });
  await context.addIndex("wwl_participants", ["updatedAt"], {
    name: "idx_wwl_participants_updatedAt",
  });
  await context.addIndex("wwl_studies", ["updatedAt"], {
    name: "idx_wwl_studies_updatedAt",
  });
};

export const down: Migration = async ({ context }) => {
  await context.removeIndex("wwl_sessions", "idx_wwl_sessions_studyId");
  await context.removeIndex("wwl_responses", "idx_wwl_responses_sessionId");
  await context.removeIndex("wwl_responses", "idx_wwl_responses_updatedAt");
  await context.removeIndex("wwl_sessions", "idx_wwl_sessions_updatedAt");
  await context.removeIndex(
    "wwl_participants",
    "idx_wwl_participants_updatedAt",
  );
  await context.removeIndex("wwl_studies", "idx_wwl_studies_updatedAt");
};
