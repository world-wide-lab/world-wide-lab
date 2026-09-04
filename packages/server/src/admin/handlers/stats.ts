import {
  type ActionHandler,
  type ActionResponse,
  NotFoundError,
  type PageContext,
  type PageHandler,
} from "adminjs";
import { cache } from "../../cache.js";
import sequelize from "../../db/index.js";
import { getStats, sanitizeTimeframe } from "../../stats/index.js";

// Name of the page in the admin UI, also used to link to it
const STATS_PAGE_NAME = "Stats";

// The statistics run across all collected data, which can take a moment on
// larger databases, so their results are cached for a short while.
const CACHE_TTL = 30 * 1000; /* milliseconds */

export { STATS_PAGE_NAME };

export const statsHandler: PageHandler = async (
  request: any,
  response: any,
  context: PageContext,
): Promise<any> => {
  const query = request.query || {};

  const studyId =
    typeof query.studyId === "string" && query.studyId !== ""
      ? query.studyId
      : undefined;
  const days = sanitizeTimeframe(query.days);

  return await cache.wrap(
    `stats-${days}-${studyId}`,
    () => getStats(sequelize, { studyId, days }),
    CACHE_TTL,
  );
};

// Open the stats page with the given study pre-selected
export const viewStudyStatsHandler: ActionHandler<ActionResponse> = async (
  request,
  response,
  context,
) => {
  const { record, currentAdmin, h } = context;

  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      'You have to pass "recordId" to the View Stats Action',
      "Action#handler",
    );
  }

  const studyId = encodeURIComponent(String(record.id()));
  return {
    record: record.toJSON(currentAdmin),
    redirectUrl: `${h.pageUrl(STATS_PAGE_NAME)}?studyId=${studyId}`,
  };
};
