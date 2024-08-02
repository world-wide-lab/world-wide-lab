import execa from "execa";

import {
  type Requirement,
  commonRequirements,
  getFailureResult,
  getSuccessResult,
} from "../requirements";

const awsOnlyRequirements: Requirement[] = [
  {
    name: "AWS CLI is installed",
    check: async () => {
      try {
        await execa("aws", ["--version"]);
        return getSuccessResult();
      } catch (err) {
        return getFailureResult("Please Install AWS CLI");
      }
    },
  },
  {
    name: "AWS CLI is configured",
    check: async () => {
      try {
        await execa("aws", ["sts", "get-caller-identity"]);
        return getSuccessResult();
      } catch (err) {
        return getFailureResult("Please log into the AWS CLI");
      }
    },
  },
];

export const awsRequirements = [...commonRequirements, ...awsOnlyRequirements];
