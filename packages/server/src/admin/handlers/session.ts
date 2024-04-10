import {
  ActionContext,
  ActionRequest,
  ActionResponse,
  NotFoundError,
} from "adminjs";
import { QueryTypes } from "sequelize";
import sequelize from "../../db/index.js";

async function viewSessionResponsesHandler(
  request: ActionRequest,
  response: ActionResponse,
  context: ActionContext,
): Promise<ActionResponse> {
  const { record, resource, currentAdmin, h, translateMessage } = context;

  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      ['You have to pass "recordId" to the View Session Responses Action'].join(
        "\n",
      ),
      "Action#handler",
    );
  }

  return {
    record: record.toJSON(currentAdmin),
    redirectUrl: h.listUrl(
      "wwl_responses",
      `?filters.sessionId=${record.id()}`,
    ),
  };
}

export { viewSessionResponsesHandler as viewSessionHandler };
