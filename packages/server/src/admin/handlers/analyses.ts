import type { PageContext, PageHandler } from "adminjs";
import { getAnalyses, sanitizeTimeframe } from "../../analyses/index.js";
import { cache } from "../../cache.js";
import sequelize from "../../db/index.js";

// Analyses run across all data, which can take a moment on larger databases,
// so their results are cached for a short while.
const CACHE_TTL = 30 * 1000; /* milliseconds */

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
