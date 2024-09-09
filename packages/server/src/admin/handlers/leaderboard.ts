import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
} from "adminjs";
import { QueryTypes } from "sequelize";
import sequelize from "../../db/index.js";

async function viewLeaderboardScoresHandler(
  request: ActionRequest,
  response: ActionResponse,
  context: ActionContext,
): Promise<ActionResponse> {
  const { record, resource, currentAdmin, h } = context;

  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      [
        'You have to pass "recordId" to the View Leaderboard Scores Action',
      ].join("\n"),
      "Action#handler",
    );
  }

  return {
    record: record.toJSON(currentAdmin),
    redirectUrl: h.listUrl(
      "wwl_leaderboard_scores",
      `?filters.leaderboardId=${record.id()}`,
    ),
  };
}

export { viewLeaderboardScoresHandler };
