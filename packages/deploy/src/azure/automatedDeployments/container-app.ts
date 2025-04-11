import type { WwlPulumiDeployment } from "../../deployment";
import { WwlAzureContainerAppDeployment } from "../pulumiDeployments/container-app";

import type { automation } from "@pulumi/pulumi";
import { WwlAutomatedDeployment } from "../../deployment";
import { azureRequirements } from "./requirements";

export class WwlAzureContainerAppAutomatedDeployment extends WwlAutomatedDeployment {
  requirements = azureRequirements;

  defaultStackConfiguration = {
    resourceGroupName: "rg-world-wide-lab",
  };

  PulumiDeployment: typeof WwlPulumiDeployment = WwlAzureContainerAppDeployment;

  async onInitPulumiStack(
    pulumiStack: automation.Stack,
    combinedStackConfiguration,
  ): Promise<void> {
    await pulumiStack.workspace.installPlugin("azure-native", "v2.83.0");
  }
}
