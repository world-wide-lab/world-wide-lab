import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
} from "adminjs";

import { AutomatedDeployments } from "@world-wide-lab/deploy";
import type { WwlAutomatedDeployment } from "@world-wide-lab/deploy/dist/deployment.js";

export async function deployDeploymentHandler(
  request: ActionRequest,
  response: ActionResponse,
  context: ActionContext,
): Promise<ActionResponse> {
  const { record, resource, currentAdmin, h } = context;

  if (!request.query || !request.query.deploymentAction) {
    throw new NotFoundError(
      'You have to pass "deploymentAction" to the Deployment Action',
      "Action#handler",
    );
  }
  const { deploymentAction } = request.query;

  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      'You have to pass "recordId" to the Deployment Action',
      "Action#handler",
    );
  }

  const responseObject: { [key: string]: any } = {
    record: record.toJSON(currentAdmin),
  };

  // Find correct deployment
  const provider = record.params.provider;
  const type = record.params.type;

  if (!(provider in AutomatedDeployments)) {
    throw new NotFoundError(
      "Provider not found in Deployments",
      "Action#handler",
    );
  }
  // @ts-ignore
  if (!(type in AutomatedDeployments[provider])) {
    throw new NotFoundError(
      "Provider not found in Deployments",
      "Action#handler",
    );
  }
  // @ts-ignore Should be safe after the above checks...
  const deployment: WwlAutomatedDeployment = new AutomatedDeployments[provider][
    type
  ]();

  // Check Requirements
  let valid = true;
  let message = "";
  const requirementsList = [];
  for (const requirement of deployment.requirements) {
    const run = valid;
    if (run) {
      try {
        const result = await requirement.check();
        valid = result.success;
        if (!result.success) {
          message = result.message;
        }
      } catch (err) {
        valid = false;
        if (err instanceof Error) {
          message = err.message;
        } else {
          message = `An unknown error occurred: ${err}`;
        }
      }
    }
    requirementsList.push({
      name: requirement.name,
      status: run ? (valid ? "success" : "error") : "skipped",
      message: message,
    });
  }
  responseObject.requirementsList = requirementsList;
  responseObject.requirementsStatus = valid ? "success" : "error";
  if (!valid) {
    return responseObject;
  }

  return responseObject;
}
