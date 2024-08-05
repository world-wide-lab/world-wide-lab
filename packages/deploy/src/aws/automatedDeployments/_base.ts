import type { automation } from "@pulumi/pulumi";
import { WwlAutomatedDeployment } from "../../deployment";
import { awsRequirements } from "./requirements";

export abstract class WwlAwsBaseAutomatedDeployment extends WwlAutomatedDeployment {
  requirements = awsRequirements;

  defaultStackConfiguration = {
    awsRegion: "us-east-1",
  };

  async onInitPulumiStack(
    pulumiStack: automation.Stack,
    combinedStackConfiguration,
  ): Promise<void> {
    await pulumiStack.workspace.installPlugin("aws", "v6.47.0");

    await pulumiStack.setConfig("aws:region", {
      value: combinedStackConfiguration.awsRegion,
    });
  }
}
