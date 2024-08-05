import {
  type ActionContext,
  type ActionRequest,
  type ActionResponse,
  NotFoundError,
} from "adminjs";

// @ts-ignore - Only type imported
import type { WwlAutomatedDeployment } from "@world-wide-lab/deploy/dist/deployment.js";

import { logger } from "../../logger.js";
import { extractJsonObjectFromRecord } from "../helpers.js";

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
  const validDeploymentActions = [
    "requirements",
    "refresh",
    "preview",
    "deploy",
    "destroy",
  ];
  if (!validDeploymentActions.includes(deploymentAction)) {
    throw new NotFoundError(
      `Invalid deploymentAction: ${deploymentAction}. Must be one of ${validDeploymentActions}`,
      "Action#handler",
    );
  }

  if (!request.params.recordId || !record) {
    throw new NotFoundError(
      'You have to pass "recordId" to the Deployment Action',
      "Action#handler",
    );
  }

  const responseObject: { [key: string]: any } = {
    record: record.toJSON(currentAdmin),
    deploymentAction,
  };

  // Find correct deployment
  const type = record.params.type;

  // @ts-ignore - This should not be callable if the record is not found
  const { AutomatedDeployments } = await import("@world-wide-lab/deploy");
  // @ts-ignore
  if (!(type in AutomatedDeployments)) {
    throw new NotFoundError(
      "Provider not found in Deployments",
      "Action#handler",
    );
  }

  // @ts-ignore Should be safe after the above checks...
  const deployment: WwlAutomatedDeployment = new AutomatedDeployments[type]();

  // Check requirements
  if (deploymentAction === "requirements") {
    logger.info("Checking requirements");

    let valid = true;
    let message = "";
    let errorMessage = undefined;
    const requirementsList = [];
    for (const requirement of deployment.requirements) {
      const run = valid;
      if (run) {
        try {
          const result = await requirement.check();
          valid = result.success;
          if (!result.success) {
            message = result.message;
            errorMessage = result.errorMessage || undefined;
          }
        } catch (err) {
          valid = false;
          message = "An unexpected error occurred";
          errorMessage = (err as Error).message || undefined;
        }
      }
      requirementsList.push({
        name: requirement.name,
        status: run ? (valid ? "success" : "error") : "skipped",
        message: message,
        errorMessage: errorMessage,
      });
    }
    responseObject.requirementsList = requirementsList;
    responseObject.requirementsStatus = valid ? "success" : "error";
    logger.info("Requirements check passed");

    return responseObject;
  }

  // Initialize stack
  logger.info("Initializing Pulumi Stack");
  const stackConfig = extractJsonObjectFromRecord("stackConfig", record);
  const deploymentConfig = extractJsonObjectFromRecord(
    "deploymentConfig",
    record,
  );
  await deployment.initStack(
    "wwl",
    record.params.name,
    stackConfig || {},
    deploymentConfig || {},
  );
  logger.info("Pulumi Stack initialized");

  switch (deploymentAction) {
    case "refresh": {
      logger.info("Refreshing Deployment");
      const result = await deployment.refresh();
      responseObject.result = result;
      break;
    }
    case "preview": {
      logger.info("Previewing Deployment");
      const result = await deployment.preview();
      responseObject.result = result;
      break;
    }
  }

  return responseObject;
}
