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
      // Optional detailed error message
      errorMessage?: string;
    };

export function getSuccessResult(): RequirementsResult {
  return {
    success: true,
  };
}

export function getFailureResult(
  message: string,
  errorMessage?: string,
): RequirementsResult {
  return {
    success: false,
    message,
    errorMessage,
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
    check: async () => {
      try {
        PulumiCommand.get();
        return getSuccessResult();
      } catch (err) {
        if (err instanceof CommandError) {
          return getFailureResult("Please Install Pulumi CLI");
        }
        throw err;
      }
    },
  },
];
