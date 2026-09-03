import type { PageContext, PageHandler } from "adminjs";
import { getSessionsOverTime } from "../../analyses/index.js";
import config from "../../config.js";
import sequelize from "../../db/index.js";

// Number of days shown in the dashboard's chart
const DASHBOARD_TIMEFRAME = 7;

export const dashboardHandler: PageHandler = async (
  request: any,
  response: any,
  context: PageContext,
): Promise<any> => {
  const studyCount = await sequelize.models.Study.count();
  const sessionsOverTime = await getSessionsOverTime(sequelize, {
    days: DASHBOARD_TIMEFRAME,
  });

  return {
    studyCount,
    sessionsOverTime,
    electronApp: config.electronApp,
  };
};
