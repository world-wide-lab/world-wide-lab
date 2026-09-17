// Everything that has to happen inside the database for item pools to behave
// correctly when more than one participant (or more than one instance) is
// active at the same time.

import { QueryTypes, type Transaction } from "sequelize";
import { AppError } from "../errors.js";
import sequelize from "./index.js";

type ModerationMode = "reviewed" | "unreviewed" | "closed";
type ItemStatus = "pending" | "approved" | "rejected" | "retired";
type DrawPolicy = "random" | "least-drawn" | "newest" | "oldest";

// Which items are visible to other participants is a function of the pool's
// moderation mode and the item's status, never of the item's status alone.
// That way switching a pool from 'unreviewed' to 'reviewed' immediately hides
// everything nobody has approved, while explicitly approved items stay up.
function visibleItemStatuses(moderation: ModerationMode): ItemStatus[] {
  return moderation === "unreviewed" ? ["pending", "approved"] : ["approved"];
}

const policyOrder: Record<DrawPolicy, string> = {
  random: "RANDOM()",
  "least-drawn": 'i."timesDrawn" ASC, RANDOM()',
  newest: 'i."createdAt" DESC',
  oldest: 'i."createdAt" ASC',
};

// Sequelize hands out a single connection for sqlite, so two overlapping
// transactions would try to nest their BEGIN statements on it and fail. Since
// sqlite is only ever used by a single instance (the desktop app, or a local
// file), queueing the transactions in-process is enough to keep them apart.
// On postgres the database does the serialising and nothing is queued.
let sqliteTransactionQueue: Promise<unknown> = Promise.resolve();

// Run something in a transaction, serialising transactions on sqlite. Every
// transaction touching items has to go through here, so that none of them can
// overlap with any other.
function itemTransaction<T>(run: (transaction: Transaction) => Promise<T>) {
  const start = () => sequelize.transaction(run);

  if (sequelize.getDialect() !== "sqlite") {
    return start();
  }

  const result = sqliteTransactionQueue.then(start, start);
  // Keep the queue going even if this transaction failed
  sqliteTransactionQueue = result.catch(() => undefined);
  return result;
}

interface DrawOptions {
  poolId: string;
  moderation: ModerationMode;
  sessionId: string;
  // The participant behind the drawing session, if there is one. Used to also
  // exclude items this person contributed in one of their other sessions.
  participantId?: string | null;
  count: number;
  policy: DrawPolicy;
  excludeOwn: boolean;
  excludeSeen: boolean;
  maxDrawsPerItem?: number;
  maxCompletionsPerItem?: number;
  minGeneration?: number;
  maxGeneration?: number;
}

// Claim up to `count` items for a session and record a draw for each of them.
//
// The claim has to happen in a single statement, since the response cache is
// per-instance and a read-then-write in node would let two concurrent draws
// slip past the same serving limit. The statement below picks the rows and
// increments their counter at the same time, so a limit can never be exceeded,
// no matter how many instances are running.
async function drawItems(options: DrawOptions) {
  const isPostgres = sequelize.getDialect() === "postgres";

  const conditions = ['i."poolId" = :poolId', 'i."status" IN (:statuses)'];
  const replacements: { [key: string]: any } = {
    poolId: options.poolId,
    statuses: visibleItemStatuses(options.moderation),
    sessionId: options.sessionId,
    count: options.count,
    now: new Date(),
  };

  if (options.maxDrawsPerItem !== undefined) {
    conditions.push('i."timesDrawn" < :maxDrawsPerItem');
    replacements.maxDrawsPerItem = options.maxDrawsPerItem;
  }
  if (options.maxCompletionsPerItem !== undefined) {
    conditions.push('i."timesCompleted" < :maxCompletionsPerItem');
    replacements.maxCompletionsPerItem = options.maxCompletionsPerItem;
  }
  if (options.minGeneration !== undefined) {
    conditions.push('i."generation" >= :minGeneration');
    replacements.minGeneration = options.minGeneration;
  }
  if (options.maxGeneration !== undefined) {
    conditions.push('i."generation" <= :maxGeneration');
    replacements.maxGeneration = options.maxGeneration;
  }
  if (options.excludeOwn) {
    // Exclude everything this session contributed and, when we know who is
    // behind the session, everything they contributed in their other sessions.
    const ownSession = 's."sessionId" = :sessionId';
    let own = ownSession;
    if (options.participantId) {
      own = `(${ownSession} OR s."participantId" = :participantId)`;
      replacements.participantId = options.participantId;
    }
    conditions.push(`
      NOT EXISTS (
        SELECT 1 FROM wwl_sessions s
         WHERE s."sessionId" = i."sourceSessionId"
           AND ${own}
      )`);
  }
  if (options.excludeSeen) {
    conditions.push(`
      NOT EXISTS (
        SELECT 1 FROM wwl_item_draws d
         WHERE d."itemId" = i."itemId"
           AND d."sessionId" = :sessionId
      )`);
  }

  // Skipping rows another transaction is already claiming keeps concurrent
  // draws from queueing up behind each other. It is postgres-only; sqlite
  // serialises writes anyway.
  const lock = isPostgres ? "FOR UPDATE SKIP LOCKED" : "";

  const claimQuery = `
    WITH claimed AS (
      SELECT i."itemId"
        FROM wwl_items i
       WHERE ${conditions.join("\n         AND ")}
       ORDER BY ${policyOrder[options.policy]}
       LIMIT :count
       ${lock}
    )
    UPDATE wwl_items
       SET "timesDrawn" = "timesDrawn" + 1,
           "updatedAt" = :now
     WHERE "itemId" IN (SELECT "itemId" FROM claimed)
    RETURNING "itemId"
  `;

  return await itemTransaction(async (transaction) => {
    const claimed = (await sequelize.query(claimQuery, {
      type: QueryTypes.SELECT,
      replacements,
      transaction,
    })) as Array<{ itemId: string }>;

    const itemIds = claimed.map((row) => row.itemId);
    if (itemIds.length === 0) {
      return [];
    }

    const draws = (await sequelize.models.ItemDraw.bulkCreate(
      itemIds.map((itemId) => ({ itemId, sessionId: options.sessionId })),
      { transaction },
    )) as any[];

    const items = (await sequelize.models.Item.findAll({
      where: { itemId: itemIds },
      transaction,
    })) as any[];
    const itemsById = new Map(items.map((item) => [item.itemId, item]));

    // Keep the order the items were claimed in, so that e.g. the oldest item
    // of an 'oldest' draw comes first.
    return draws.map((draw) => ({
      draw,
      item: itemsById.get(draw.itemId),
    }));
  });
}

// Mark a draw as completed and count the completion on its item. Completing a
// draw twice is a no-op, so that a study which closes a draw explicitly and
// via its last response does not count the completion twice.
async function completeDraw(
  drawId: string,
  sessionId: string,
  transaction?: Transaction,
) {
  const draw = (await sequelize.models.ItemDraw.findOne({
    where: { drawId, sessionId },
    transaction,
  })) as any;

  if (!draw) {
    throw new AppError("Unknown drawId", 400);
  }

  const [updatedRows] = await sequelize.models.ItemDraw.update(
    { status: "completed" },
    { where: { drawId, sessionId, status: "served" }, transaction },
  );

  if (updatedRows === 1) {
    await sequelize.models.Item.increment("timesCompleted", {
      by: 1,
      where: { itemId: draw.itemId },
      transaction,
    });
  }

  return draw;
}

export { drawItems, completeDraw, itemTransaction, visibleItemStatuses };
export type { DrawPolicy, ItemStatus, ModerationMode };
