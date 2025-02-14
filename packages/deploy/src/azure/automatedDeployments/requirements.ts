import execa from "execa";

import {
  type Requirement,
  commonRequirements,
  getFailureResult,
  getSuccessResult,
} from "../../requirements";

const azureOnlyRequirements: Requirement[] = [
  {
    name: "Azure CLI is installed",
    url: "https://learn.microsoft.com/en-us/cli/azure/install-azure-cli",
    check: async () => {
      try {
        await execa("az", ["--version"]);
        return getSuccessResult();
      } catch (err) {
        return getFailureResult(
          "Please install the Azure CLI and make sure it is findable by World-Wide-Lab.",
          err,
        );
      }
    },
  },
  {
    name: "Logged into Azure CLI",
    url: "https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli",
    check: async () => {
      try {
        await execa("az", ["ad", "signed-in-user", "show"]);
        return getSuccessResult();
      } catch (err) {
        return getFailureResult(
          "Please log into the Azure CLI and check your internet connection (deployments require an internet connection).",
          err,
        );
      }
    },
  },
];

export const azureRequirements = [...commonRequirements, ...azureOnlyRequirements];
