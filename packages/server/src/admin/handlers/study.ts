import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
  ValidationError,
  paramConverter,
  populator,
} from "adminjs";
import { QueryTypes } from "sequelize";
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

    // (1) Delete all responses associated with this study
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

    // (2) Delete all sessions belonging to the study
    await sequelize.models.Session.destroy({
      where: {
        studyId,
      },
    });

    // (3) Delete the study itself
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

export { newStudyHandler, deleteStudyHandler, downloadStudyDataHandler };
