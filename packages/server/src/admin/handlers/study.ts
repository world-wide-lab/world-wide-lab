import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
  ValidationError,
  paramConverter,
  populator,
} from "adminjs";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../db/index.js";

// Based off original AdminJS code
// https://github.com/SoftwareBrothers/adminjs/blob/v6.8.7/src/backend/actions/new/new-action.ts
async function newStudyHandler(
  request: ActionRequest,
  response: ActionResponse,
  context: ActionContext,
) {
  const { resource, h, currentAdmin } = context;
  if (request.method === "post") {
    const params = paramConverter.prepareParams(
      request.payload ?? {},
      resource,
    );

    const record = await resource.build(params);

    // * Beginning of changes *
    // Old Code:
    // Context: https://github.com/SoftwareBrothers/adminjs/blob/master/src/backend/adapters/record/base-record.ts#L203
    // record = await record.create(context)
    // New Code:
    const returnedParams = await sequelize.models.Study.create(record.params);
    record.storeParams(returnedParams);
    // * End of changes *
    const [populatedRecord] = await populator([record], context);

    // eslint-disable-next-line no-param-reassign
    context.record = populatedRecord;

    if (record.isValid()) {
      return {
        redirectUrl: h.resourceUrl({
          resourceId: resource._decorated?.id() || resource.id(),
        }),
        notice: {
          message: "successfullyCreated",
          type: "success",
        },
        record: record.toJSON(currentAdmin),
      };
    }
    const baseMessage =
      populatedRecord.baseError?.message || "thereWereValidationErrors";
    return {
      record: record.toJSON(currentAdmin),
      notice: {
        message: baseMessage,
        type: "error",
      },
    };
  }
  // TODO: add wrong implementation error
  throw new Error("new action can be invoked only via `post` http method");
}

// Remove everything an item pool holds for a single study: the study's own
// pools with all of their items, and the record of what its sessions drew.
// Items the study contributed to a pool it does not own stay where they are,
// since other studies keep drawing from that pool, but they are stripped of
// their link to the sessions and responses that are about to disappear.
async function deleteStudyItems(studyId: string) {
  const sessionIds = (
    await sequelize.models.Session.findAll({
      where: { studyId },
      attributes: ["sessionId"],
      raw: true,
    })
  ).map((session: any) => session.sessionId);

  const poolIds = (
    await sequelize.models.ItemPool.findAll({
      where: { studyId },
      attributes: ["poolId"],
      raw: true,
    })
  ).map((pool: any) => pool.poolId);

  const itemIds =
    poolIds.length > 0
      ? (
          await sequelize.models.Item.findAll({
            where: { poolId: poolIds },
            attributes: ["itemId"],
            raw: true,
          })
        ).map((item: any) => item.itemId)
      : [];

  // Every draw of a doomed item, plus everything this study's sessions drew
  const drawConditions = [];
  if (sessionIds.length > 0) {
    drawConditions.push({ sessionId: sessionIds });
  }
  if (itemIds.length > 0) {
    drawConditions.push({ itemId: itemIds });
  }
  const drawIds =
    drawConditions.length > 0
      ? (
          await sequelize.models.ItemDraw.findAll({
            where: { [Op.or]: drawConditions },
            attributes: ["drawId"],
            raw: true,
          })
        ).map((draw: any) => draw.drawId)
      : [];

  if (drawIds.length > 0) {
    // Responses of other studies can point at these draws. Those responses are
    // not ours to delete, so they only lose the link.
    await sequelize.models.Response.update(
      { drawId: null },
      { where: { drawId: drawIds } },
    );
    await sequelize.models.ItemDraw.destroy({ where: { drawId: drawIds } });
  }

  if (sessionIds.length > 0) {
    await sequelize.models.Item.update(
      { sourceSessionId: null, sourceResponseId: null },
      { where: { sourceSessionId: sessionIds } },
    );
  }

  if (itemIds.length > 0) {
    // Chains in other pools can reach into this one
    await sequelize.models.Item.update(
      { parentItemId: null },
      { where: { parentItemId: itemIds } },
    );
    await sequelize.models.Item.destroy({ where: { itemId: itemIds } });
  }

  if (poolIds.length > 0) {
    await sequelize.models.ItemPool.destroy({ where: { poolId: poolIds } });
  }
}

async function deleteStudyHandler(
  request: ActionRequest,
  response: ActionResponse,
  context: ActionContext,
) {
  const { record, resource, currentAdmin, h } = context;
  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      ['You have to pass "recordId" to Delete Action'].join("\n"),
      "Action#handler",
    );
  }
  // Stop the whole process if deletionProtection is enabled
  if (record.params.deletionProtection) {
    return {
      record: record.toJSON(currentAdmin),
      notice: {
        message:
          "Please disable deletion protection before trying to delete a study. Be warned, that deleting a study will also delete ALL ITS DATA.",
        type: "error",
      },
    };
  }

  try {
    // Actually delete all the data
    const studyId = record.id();

    // (1) Delete the items and draws belonging to this study. This has to
    // happen before the responses, since items can point at the response they
    // were generated from. Pools shared across studies (i.e. without a
    // studyId) survive, they just lose their link to this study's data.
    await deleteStudyItems(studyId);

    // (2) Delete all responses associated with this study
    await sequelize.query(
      `
        DELETE FROM
          wwl_responses
        WHERE sessionId IN (
          SELECT sessionId
          FROM wwl_sessions
          WHERE studyId = :studyId
        );`,
      {
        type: QueryTypes.DELETE,
        replacements: {
          studyId,
        },
      },
    );

    // (3) Delete all sessions belonging to the study
    await sequelize.models.Session.destroy({
      where: {
        studyId,
      },
    });

    // (4) Delete the study itself
    await resource.delete(request.params.recordId, context);

    // Done with actual deleting of stuff!
  } catch (error) {
    if (error instanceof ValidationError) {
      const baseMessage =
        error.baseError?.message || "thereWereValidationErrors";
      return {
        record: record.toJSON(currentAdmin),
        notice: {
          message: baseMessage,
          type: "error",
        },
      };
    }
    throw error;
  }

  return {
    record: record.toJSON(currentAdmin),
    redirectUrl: h.resourceUrl({
      resourceId: resource._decorated?.id() || resource.id(),
    }),
    notice: {
      message: "successfullyDeleted",
      type: "success",
    },
  };
}

async function downloadStudyDataHandler(
  request: ActionRequest,
  response: ActionResponse,
  context: ActionContext,
) {
  const { record, currentAdmin } = context;
  if (record === undefined) {
    throw new Error("Missing record information");
  }

  return {
    record: record.toJSON(currentAdmin),
  };
}

export {
  newStudyHandler,
  deleteStudyHandler,
  deleteStudyItems,
  downloadStudyDataHandler,
};
