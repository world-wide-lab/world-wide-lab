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

const validDeploymentCommands = [
  "refresh",
  "preview",
  "deploy",
  "destroy",
] as const;

// Which actions are allowed to be called
const validDeploymentActions = [
  "requirements",
  "update",
  ...validDeploymentCommands,
] as const;

class DeploymentActivity {
  /**
   * Represents an ongoing and asynchronous deployment activity.
   * This activity collects regular updates and can be queries to provide
   * the current status and collected output.
   */

  command: (typeof validDeploymentCommands)[number];
  status: "created" | "running" | "finished";
  output: string;
  lastUpdated = "";
  finalResult: any;

  // Start a new activity
  constructor(command: (typeof validDeploymentCommands)[number]) {
    this.command = command;
    this.output = "";
    this.status = "created";
    this.updateTime();
  }

  private updateTime() {
    this.lastUpdated = new Date().toISOString();
  }

  // Finish the activity
  private finish(result: any) {
    this.status = "finished";
    this.finalResult = result;
  }

  // Get new interim outputs from the activity
  private appendOutput(output: string) {
    this.output += output;
    this.updateTime();
  }

  // Run an asynchronous pulumi command
  async runCommand(
    functionToRun: (options: {
      onOutput: (output: string) => void;
    }) => Promise<any>,
    onSuccess?: () => void,
    onError?: () => void,
  ) {
    this.status = "running";

    try {
      // Run the command / function and pass it onOutput
      const result = await functionToRun({
        onOutput: (output) => {
          this.appendOutput(output);
        },
      });

      // Finish the activity
      this.finish(result);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      this.finish({
        error: "Internal error executing command",
        message: (error as Error).toString(),
      });
      console.error(error);

      if (onError) {
        onError();
      }
    }
  }

  // Get the result of the activity, this can be called while the activity is running or afterwards
  getResult() {
    return {
      command: this.command,
      status: this.status,
      lastUpdated: this.lastUpdated,

      ...(this.finalResult || {
        stdout: this.output,
      }),
    };
  }
}

// Global object, that keeps track of currently running activities
// IMPORTANT: This is not designed to be scalable right now, as it is only intended
// to run in the non-scaling electron desktop app!
const runningActivities: {
  [key: string]: DeploymentActivity;
} = {};

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
  const recordId = request.params.recordId;

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
      "Deployment type not found in Deployments",
      "Action#handler",
    );
  }

  // @ts-ignore Should be safe after the above checks...
  const deployment: WwlAutomatedDeployment = new AutomatedDeployments[type]();

  // === Action: requirements ===
  // Check requirements
  if (deploymentAction === "requirements") {
    logger.info("Checking requirements");

    let valid = true;
    const requirementsList = [];
    for (const requirement of deployment.requirements) {
      let message = "";
      let errorMessage = undefined;
      const run = valid;
      if (run) {
        try {
          const result = await requirement.check();
          valid = result.success;
          if (!result.success) {
            message = result.message;
            errorMessage = result.error?.toString() || undefined;
          }
        } catch (err) {
          valid = false;
          message = "An unexpected error occurred";
          errorMessage = (err as Error)?.toString() || undefined;
        }
      }
      requirementsList.push({
        name: requirement.name,
        status: run ? (valid ? "success" : "error") : "skipped",
        url: requirement.url,
        message: message,
        errorMessage: errorMessage,
      });
    }
    responseObject.requirementsList = requirementsList;
    responseObject.requirementsStatus = valid ? "success" : "error";
    logger.info("Requirements check passed");

    return responseObject;
  }

  // === Action: update ===
  // Check if an activity is running
  const previousActivity = runningActivities[recordId];
  if (deploymentAction === "update") {
    // We just want to check for updates, so return those if possible
    if (!previousActivity) {
      throw new NotFoundError(
        `There is no active deployment for ${recordId}`,
        "Action#handler",
      );
    }
    responseObject.result = previousActivity.getResult();
    return responseObject;
  }
  if (previousActivity && previousActivity.status === "running") {
    throw new Error(
      `A deployment is already running for ${recordId} (${record.params.name}). Please wait for it to finish.`,
    );
  }

  // === Action: refresh, preview, deploy, destroy (proper pulumi actions) ===
  // Some of these can take literal *minutes*, so the server only ever allows running of them
  // and the client can query for updates.

  // Initialize pulumi stack
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

  const currentActivity = new DeploymentActivity(deploymentAction);
  runningActivities[recordId] = currentActivity;

  switch (deploymentAction) {
    case "refresh": {
      logger.info("Refreshing Deployment");
      currentActivity.runCommand(async (opts) => deployment.refresh(opts));
      break;
    }
    case "preview": {
      logger.info("Previewing Deployment");
      currentActivity.runCommand(async (opts) => deployment.preview(opts));
      break;
    }
    case "deploy": {
      logger.info("Deploying Deployment");
      currentActivity.runCommand(
        async (opts) => deployment.deploy(opts),
        () => {
          record.update({ status: "deployed" });
        },
        () => {
          record.update({ status: "error" });
        },
      );
      break;
    }
    case "destroy": {
      logger.info("Destroying Deployment");
      currentActivity.runCommand(
        async (opts) => deployment.remove(opts),
        () => {
          record.update({ status: "undeployed" });
        },
        () => {
          record.update({ status: "error" });
        },
      );
      break;
    }
  }

  // Add result information
  responseObject.result = currentActivity.getResult();

  return responseObject;
}
