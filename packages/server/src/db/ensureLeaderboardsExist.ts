import type { Sequelize } from "sequelize";

async function ensureLeaderboardsExist(
  sequelize: Sequelize,
  leaderboardIds: string[],
) {
  await Promise.all(
    leaderboardIds.map((leaderboardId) =>
      ensureLeaderboardExists(sequelize, leaderboardId),
    ),
  );
}

async function ensureLeaderboardExists(
  sequelize: Sequelize,
  leaderboardId: string,
) {
  const existingLeaderboardCount = (
    await sequelize.models.Leaderboard.findAndCountAll({
      where: {
        leaderboardId,
      },
    })
  ).count;

  if (existingLeaderboardCount > 0) {
    // Leaderboard already exists
    return;
  }

  // Create leaderboard
  await sequelize.models.Leaderboard.create({
    leaderboardId,
  });
}

export { ensureLeaderboardsExist, ensureLeaderboardExists };
