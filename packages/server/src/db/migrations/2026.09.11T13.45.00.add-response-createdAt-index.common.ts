import type { Migration } from "../migrate.js";

export const up: Migration = async ({ context }) => {
  // The statistics limit responses to a timeframe, just like sessions
  await context.addIndex("wwl_responses", ["createdAt"], {
    name: "idx_wwl_responses_createdAt",
  });
};

export const down: Migration = async ({ context }) => {
  await context.removeIndex("wwl_responses", "idx_wwl_responses_createdAt");
};
