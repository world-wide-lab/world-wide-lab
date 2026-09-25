import { QueryTypes, type Transaction } from "sequelize";
import { AppError } from "../errors.js";
import sequelize from "./index.js";

type ModerationMode = "reviewed" | "unreviewed" | "closed";
type ItemStatus = "pending" | "approved" | "rejected" | "retired" | "withdrawn";
type DrawPolicy = "random" | "least-drawn" | "newest" | "oldest";

function visibleItemStatuses(moderation: ModerationMode): ItemStatus[] {
  return moderation === "unreviewed" ? ["pending", "approved"] : ["approved"];
}

// itemId breaks ties between items created in the same millisecond
const policyOrder: Record<DrawPolicy, string> = {
  random: "RANDOM()",
  "least-drawn": 'i."timesDrawn" ASC, RANDOM()',
  newest: 'i."createdAt" DESC, i."itemId" DESC',
  oldest: 'i."createdAt" ASC, i."itemId" ASC',
};

// Sequelize shares one sqlite connection, so overlapping transactions would nest their BEGINs; queue them in-process instead
let sqliteTransactionQueue: Promise<unknown> = Promise.resolve();

// Every transaction touching items has to go through here
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
  // Used to also exclude items contributed in the participant's other sessions
  participantId?: string | null;
  count: number;
  policy: DrawPolicy;
  excludeOwn: boolean;
  excludeSeen: boolean;
  maxDrawsPerItem?: number;
  maxCompletionsPerItem?: number;
  maxChildrenPerItem?: number;
  minGeneration?: number;
  maxGeneration?: number;
}

// Claim up to `count` items in a single statement, so concurrent draws can't slip past the same limit
async function drawItems(options: DrawOptions) {
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
  if (options.maxChildrenPerItem !== undefined) {
    // Pending children count (so the chain doesn't branch), rejected or withdrawn ones don't
    conditions.push(`
      (SELECT COUNT(*) FROM wwl_items c
        WHERE c."parentItemId" = i."itemId"
          AND c."status" NOT IN (:uncountedChildStatuses)
      ) < :maxChildrenPerItem`);
    replacements.maxChildrenPerItem = options.maxChildrenPerItem;
    replacements.uncountedChildStatuses = ["rejected", "withdrawn"];
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

  // Keep concurrent draws from queueing behind each other (sqlite serialises writes anyway)
  const lock =
    sequelize.getDialect() === "postgres" ? "FOR UPDATE SKIP LOCKED" : "";

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

    // Keep the order the items were claimed in
    return draws.map((draw) => ({
      draw,
      item: itemsById.get(draw.itemId),
    }));
  });
}

// Mark a draw as completed and count it on its item; completing twice is a no-op
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
export type { DrawPolicy, ModerationMode };
