import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
} from "adminjs";
import { Op } from "sequelize";
import sequelize from "../../db/index.js";

// Jump from a record to the rows belonging to it, e.g. from a pool to its items
function createViewHandler(resourceId: string, filterKey: string) {
  return async (
    request: ActionRequest,
    response: ActionResponse,
    context: ActionContext,
  ): Promise<ActionResponse> => {
    const { record, currentAdmin, h } = context;

    if (!request.params.recordId || !record) {
      throw new NotFoundError(
        'You have to pass "recordId" to this action',
        "Action#handler",
      );
    }

    return {
      record: record.toJSON(currentAdmin),
      redirectUrl: h.listUrl(
        resourceId,
        `?filters.${filterKey}=${record.id()}`,
      ),
    };
  };
}

const viewItemsHandler = createViewHandler("wwl_items", "poolId");
const viewItemDrawsHandler = createViewHandler("wwl_item_draws", "itemId");

// Bulk moderation; items a participant withdrew are left alone so they can't be put back up by accident
function createModerationHandler(status: "approved" | "rejected" | "retired") {
  return async (
    request: ActionRequest,
    response: ActionResponse,
    context: ActionContext,
  ): Promise<ActionResponse> => {
    const { records, resource, currentAdmin, h } = context;

    if (!records || records.length === 0) {
      throw new NotFoundError(
        "You have to select at least one item",
        "Action#handler",
      );
    }

    const [updatedRows] = await sequelize.models.Item.update(
      { status },
      {
        where: {
          itemId: records.map((record) => record.id()),
          status: { [Op.ne]: "withdrawn" },
        },
      },
    );
    const skippedRows = records.length - updatedRows;

    return {
      records: records.map((record) => record.toJSON(currentAdmin)),
      redirectUrl: h.resourceUrl({
        resourceId: resource._decorated?.id() || resource.id(),
      }),
      notice: {
        message:
          skippedRows > 0
            ? `Marked ${updatedRows} item(s) as ${status}, skipped ${skippedRows} withdrawn by their participant.`
            : `Marked ${updatedRows} item(s) as ${status}.`,
        type: "success",
      },
    };
  };
}

// Open the item list on the pending items unless the query already filters, sorts or pages
async function defaultToPendingItems(
  request: ActionRequest,
): Promise<ActionRequest> {
  if (request.query && Object.keys(request.query).length === 0) {
    request.query = { "filters.status": "pending" };
  }
  return request;
}

// Researcher-seeded items need no review, so they default to approved
async function defaultToApprovedItem(
  request: ActionRequest,
): Promise<ActionRequest> {
  if (request.method === "post" && request.payload && !request.payload.status) {
    request.payload.status = "approved";
  }
  return request;
}

export {
  createModerationHandler,
  defaultToApprovedItem,
  defaultToPendingItems,
  viewItemDrawsHandler,
  viewItemsHandler,
};
