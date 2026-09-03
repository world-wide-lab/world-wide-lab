import {
  type ActionHandler,
  type ActionResponse,
  NotFoundError,
  type PageContext,
  type PageHandler,
} from "adminjs";
import { getAnalyses, sanitizeTimeframe } from "../../analyses/index.js";
import { cache } from "../../cache.js";
import sequelize from "../../db/index.js";

// Name of the page in the admin UI, also used to link to it
const ANALYSES_PAGE_NAME = "Analyses";

// Analyses run across all data, which can take a moment on larger databases,
// so their results are cached for a short while.
const CACHE_TTL = 30 * 1000; /* milliseconds */

export { ANALYSES_PAGE_NAME };

export const analysesHandler: PageHandler = async (
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
    `analyses-${days}-${studyId}`,
    () => getAnalyses(sequelize, { studyId, days }),
    CACHE_TTL,
  );
};

// Open the analyses page with the given study pre-selected
export const viewStudyAnalysesHandler: ActionHandler<ActionResponse> = async (
  request,
  response,
  context,
) => {
  const { record, currentAdmin, h } = context;

  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      'You have to pass "recordId" to the View Analyses Action',
      "Action#handler",
    );
  }

  const studyId = encodeURIComponent(String(record.id()));
  return {
    record: record.toJSON(currentAdmin),
    redirectUrl: `${h.pageUrl(ANALYSES_PAGE_NAME)}?studyId=${studyId}`,
  };
};
