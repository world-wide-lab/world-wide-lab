import type { Migration } from "../migrate.js";

// Tables which can be replicated, together with their primary key
const replicatedTables: [table: string, primaryKey: string][] = [
  ["wwl_studies", "studyId"],
  ["wwl_participants", "participantId"],
  ["wwl_sessions", "sessionId"],
  ["wwl_responses", "responseId"],
];

const compositeIndexName = (table: string) => `idx_${table}_updatedAt_pk`;
const updatedAtIndexName = (table: string) => `idx_${table}_updatedAt`;

export const up: Migration = async ({ context }) => {
  for (const [table, primaryKey] of replicatedTables) {
    // Replication walks through tables ordered by ("updatedAt", primary key),
    // so that its pages have a stable, unique order. A composite index lets
    // the database seek straight to the next page instead of sorting the
    // whole table for every page.
    await context.addIndex(table, ["updatedAt", primaryKey], {
      name: compositeIndexName(table),
    });

    // The previous index on "updatedAt" alone is now redundant, since it is
    // the leading column of the composite index above.
    await context.removeIndex(table, updatedAtIndexName(table));
  }
};

export const down: Migration = async ({ context }) => {
  for (const [table] of replicatedTables) {
    await context.addIndex(table, ["updatedAt"], {
      name: updatedAtIndexName(table),
    });
    await context.removeIndex(table, compositeIndexName(table));
  }
};
