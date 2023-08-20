import { PageHandler, PageContext } from 'adminjs'
import { Op } from 'sequelize'
import sequelize from '../../db'

const DASHBOARD_TIMEFRAME = 7;

type RunCountEntry = {
  createdAtDate: string,
  n_total: number,
  n_finished: number
}

export const dashboardHandler : PageHandler = async function (
  request: any, response: any, context: PageContext
) : Promise<any> {

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - DASHBOARD_TIMEFRAME);
  oneWeekAgo.setHours(0,0,0,0);

  const studyCount = await sequelize.models.Study.count();
  const runCounts = await sequelize.models.Run.findAll({
    attributes: [
      [sequelize.fn("DATE", sequelize.col('createdAt')), "createdAtDate"],
      [sequelize.fn('COUNT', '*'), "n_total"],
      [sequelize.literal("COUNT(*) FILTER (WHERE finished)"), "n_finished"],
    ],
    where: {
      createdAt: {
        [Op.gte]: oneWeekAgo
      }
    },
    group: [ sequelize.fn("DATE", sequelize.col('createdAt')) ],
    order: [ 'createdAtDate' ],
    raw: true,
  }) as unknown as RunCountEntry[]

  // Created missing date entries if there are no runs for that day
  let currentDate = new Date(oneWeekAgo);
  const endOfToday = new Date();
  endOfToday.setHours(23,59,59,0);
  const fullRunCounts: RunCountEntry[] = [];
  while (currentDate <= endOfToday) {
    // Get date as YYYY-MM-DD
    const currentDateString = currentDate.toISOString().split('T')[0]

    let entry, entryToAdd
    if (runCounts.length > 0) {
      entry = runCounts[0]
    }
    if (entry && entry.createdAtDate == currentDateString) {
      entryToAdd = entry
      // Remove the just added entry from array
      runCounts.pop()
    } else {
      entryToAdd = {
        createdAtDate: currentDateString,
        n_total: 0,
        n_finished: 0,
      }
    }
    fullRunCounts.push(entryToAdd)

    // Move counter to next date
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (runCounts.length > 0) {
    console.error("Issue in extraction of run counts. Found unused extra runCounts:", { runCounts, fullRunCounts })
    return { studyCount, fullRunCounts: [] }
  }

 return {
  studyCount,
  fullRunCounts,
 }
}
