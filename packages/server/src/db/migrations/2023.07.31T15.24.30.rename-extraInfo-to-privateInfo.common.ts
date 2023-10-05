import type { Migration } from "../migrate";

export const up: Migration = async ({ context }) => {
  await context.renameColumn("wwl_participants", "extraInfo", "privateInfo");
  await context.renameColumn("wwl_studies", "extraInfo", "privateInfo");
  await context.renameColumn("wwl_sessions", "extraInfo", "privateInfo");
};
export const down: Migration = async ({ context }) => {
  await context.renameColumn("wwl_participants", "privateInfo", "extraInfo");
  await context.renameColumn("wwl_studies", "privateInfo", "extraInfo");
  await context.renameColumn("wwl_sessions", "privateInfo", "extraInfo");
};
