import execa from "execa";

import {
  type Requirement,
  getFailureResult,
  getSuccessResult,
} from "../requirements";

export const awsRequirements: Requirement[] = [
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
