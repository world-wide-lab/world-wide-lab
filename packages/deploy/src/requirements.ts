import { PulumiCommand } from "@pulumi/pulumi/automation";
import { CommandError } from "@pulumi/pulumi/automation/errors";

// Typing & Helpers

export type RequirementsResult =
  | {
      success: true;
    }
  | {
      success: false;
      // Message of what went wrong
      message: string;
      // Optional: Pass along the error
      error?: Error;
    };

export function getSuccessResult(): RequirementsResult {
  return {
    success: true,
  };
}

export function getFailureResult(
  message: string,
  error?: Error,
): RequirementsResult {
  return {
    success: false,
    message,
    error,
  };
}

export type Requirement = {
  // Name of the requirement
  name: string;
  // Async Function to check the requirement
  check: () => Promise<RequirementsResult>;
  // Optional URL to further information
  url?: string;
};

// Actual Requirements

export const commonRequirements: Requirement[] = [
  {
    name: "Pulumi CLI is installed",
    url: "https://www.pulumi.com/docs/install/",
    check: async () => {
      try {
        await PulumiCommand.get();
        return getSuccessResult();
      } catch (err) {
        if (err instanceof CommandError) {
          return getFailureResult(
            "Please install the Pulumi CLI and make sure it is findable by World-Wide-Lab.",
            err,
          );
        }
        throw err;
      }
    },
  },
];
