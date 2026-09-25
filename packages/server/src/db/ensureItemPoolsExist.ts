import type { Sequelize } from "sequelize";

async function ensureItemPoolsExist(sequelize: Sequelize, poolIds: string[]) {
  await Promise.all(
    poolIds.map((poolId) => ensureItemPoolExists(sequelize, poolId)),
  );
}

async function ensureItemPoolExists(sequelize: Sequelize, poolId: string) {
  const existingPoolCount = (
    await sequelize.models.ItemPool.findAndCountAll({
      where: {
        poolId,
      },
    })
  ).count;

  if (existingPoolCount > 0) {
    return;
  }

  // Create pool
  await sequelize.models.ItemPool.create({
    poolId,
  });
}

export { ensureItemPoolsExist, ensureItemPoolExists };
