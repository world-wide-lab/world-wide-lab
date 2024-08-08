import execa from "execa";

import {
  type Requirement,
  commonRequirements,
  getFailureResult,
  getSuccessResult,
} from "../../requirements";

const awsOnlyRequirements: Requirement[] = [
  {
    name: "AWS CLI is installed",
    check: async () => {
      try {
        await execa("aws", ["--version"], {shell : true});
        return getSuccessResult();
      } catch (err) {
        return getFailureResult("Please Install the AWS CLI", err.message);
      }
    },
  },
  {
    name: "AWS CLI is configured",
    check: async () => {
      try {
        await execa("aws", ["sts", "get-caller-identity"], {shell : true});
        return getSuccessResult();
      } catch (err) {
        return getFailureResult(
          "Please log into the AWS CLI and check your internet connection",
          err.message,
        );
      }
    },
  },
];

export const awsRequirements = [...commonRequirements, ...awsOnlyRequirements];
