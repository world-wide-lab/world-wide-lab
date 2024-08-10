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
    url: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
    check: async () => {
      try {
        await execa("aws", ["--version"]);
        return getSuccessResult();
      } catch (err) {
        return getFailureResult(
          "Please install the AWS CLI and make sure it is findable by World-Wide-Lab.",
          err,
        );
      }
    },
  },
  {
    name: "AWS CLI is configured",
    url: "https://worldwidelab.org/guides/deployment#setting-up-the-aws-cli",
    check: async () => {
      try {
        await execa("aws", ["sts", "get-caller-identity"]);
        return getSuccessResult();
      } catch (err) {
        return getFailureResult(
          "Please log into the AWS CLI and check your internet connection (deployments require an internet connection).",
          err,
        );
      }
    },
  },
];

export const awsRequirements = [...commonRequirements, ...awsOnlyRequirements];
