import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
} from "adminjs";
import sequelize from "../../db/index.js";

// Jump from a record to the rows belonging to it, e.g. from a pool to its
// items or from an item to the sessions it was served to.
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

// The moderation queue works on many items at a time, so approving, rejecting
// and retiring are bulk actions over the same update.
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

    await sequelize.models.Item.update(
      { status },
      { where: { itemId: records.map((record) => record.id()) } },
    );

    return {
      records: records.map((record) => record.toJSON(currentAdmin)),
      redirectUrl: h.resourceUrl({
        resourceId: resource._decorated?.id() || resource.id(),
      }),
      notice: {
        message: `Marked ${records.length} item(s) as ${status}.`,
        type: "success",
      },
    };
  };
}

// Open the item list on the moderation queue i.e. everything nobody has
// decided on yet. Any interaction with the list (filtering, sorting, paging)
// carries query parameters along and lifts the default again.
async function defaultToPendingItems(
  request: ActionRequest,
): Promise<ActionRequest> {
  if (request.query && Object.keys(request.query).length === 0) {
    request.query = { "filters.status": "pending" };
  }
  return request;
}

// Researcher-seeded items do not need to be reviewed by anyone, so they are
// created as approved unless the researcher picks something else.
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
