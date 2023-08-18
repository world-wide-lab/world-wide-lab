import { populator, paramConverter, ActionRequest, ActionResponse, ActionContext } from 'adminjs'
import sequelize from '../db'

// Based off original AdminJS code
// https://github.com/SoftwareBrothers/adminjs/blob/v6.8.7/src/backend/actions/new/new-action.ts
async function newStudyHandler (request: ActionRequest, response: ActionResponse, context: ActionContext) {
  const { resource, h, currentAdmin, translateMessage } = context
  if (request.method === 'post') {
    const params = paramConverter.prepareParams(request.payload ?? {}, resource)

    let record = await resource.build(params)

    // * Beginning of changes *
    // Old Code:
    // Context: https://github.com/SoftwareBrothers/adminjs/blob/master/src/backend/adapters/record/base-record.ts#L203
    // record = await record.create(context)
    // New Code:
    const returnedParams = await sequelize.models.Study.create(record.params)
    record.storeParams(returnedParams)
    // * End of changes *

    const [populatedRecord] = await populator([record], context)

    // eslint-disable-next-line no-param-reassign
    context.record = populatedRecord

    if (record.isValid()) {
      return {
        redirectUrl: h.resourceUrl({ resourceId: resource._decorated?.id() || resource.id() }),
        notice: {
          message: translateMessage('successfullyCreated', resource.id()),
          type: 'success',
        },
        record: record.toJSON(currentAdmin),
      }
    }
    const baseMessage = populatedRecord.baseError?.message
      || translateMessage('thereWereValidationErrors', resource.id())
    return {
      record: record.toJSON(currentAdmin),
      notice: {
        message: baseMessage,
        type: 'error',
      },
    }
  }

  // TODO: add wrong implementation error
  throw new Error('new action can be invoked only via `post` http method')
}

async function downloadStudyDataHandler (request: ActionRequest, response: ActionResponse, context: ActionContext) {
  const { record, currentAdmin } = context
  if (record === undefined) {
    throw new Error("Missing record information")
  }

  return {
    record: record.toJSON(currentAdmin)
  }
}

export {
  newStudyHandler,
  downloadStudyDataHandler,
}
