import { PulumiCommand } from "@pulumi/pulumi/automation";
import { CommandError } from "@pulumi/pulumi/automation/errors";

// Typing & Helpers

export type RequirementsResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

export function getSuccessResult(): RequirementsResult {
  return {
    success: true,
  };
}

export function getFailureResult(message: string): RequirementsResult {
  return {
    success: false,
    message,
  };
}

export type Requirement = {
  name: string;
  check: () => Promise<RequirementsResult>;
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
