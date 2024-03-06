import { PageContext, PageHandler } from "adminjs";
import { Op } from "sequelize";
import config from "../../config";
import sequelize from "../../db";

const DASHBOARD_TIMEFRAME = 6;

type SessionCountEntry = {
  createdAtDate: string;
  n_total: number;
  n_finished: number;
};

export const dashboardHandler: PageHandler = async (
  request: any,
  response: any,
  context: PageContext,
): Promise<any> => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - DASHBOARD_TIMEFRAME);
  oneWeekAgo.setHours(0, 0, 0, 0);

  const studyCount = await sequelize.models.Study.count();
  const sessionCounts = (await sequelize.models.Session.findAll({
    attributes: [
      [sequelize.fn("DATE", sequelize.col("createdAt")), "createdAtDate"],
      [sequelize.fn("COUNT", "*"), "n_total"],
      [sequelize.literal("COUNT(*) FILTER (WHERE finished)"), "n_finished"],
    ],
    where: {
      createdAt: {
        [Op.gte]: oneWeekAgo,
      },
    },
    group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
    order: ["createdAtDate"],
    raw: true,
  })) as unknown as SessionCountEntry[];

  // Created missing date entries if there are no sessions for that day
  const currentDate = new Date(oneWeekAgo);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 0);
  const fullSessionCounts: SessionCountEntry[] = [];
  while (currentDate <= endOfToday) {
    // Get date as YYYY-MM-DD
    const currentDateString = currentDate.toISOString().split("T")[0];

    let entry, entryToAdd;
    if (sessionCounts.length > 0) {
      entry = sessionCounts[0];
    }
    if (entry && entry.createdAtDate == currentDateString) {
      entryToAdd = entry;
      // Remove the just added entry from array
      sessionCounts.shift();
    } else {
      entryToAdd = {
        createdAtDate: currentDateString,
        n_total: 0,
        n_finished: 0,
      };
    }
    fullSessionCounts.push(entryToAdd);

    // Move counter to next date
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (sessionCounts.length > 0) {
    console.error(
      "Issue in extraction of session counts. Found unused extra sessionCounts:",
      { sessionCounts, fullSessionCounts },
    );
    return { studyCount, fullSessionCounts: [] };
  }

  return {
    studyCount,
    fullSessionCounts,
    electronApp: config.electronApp,
  };
};
