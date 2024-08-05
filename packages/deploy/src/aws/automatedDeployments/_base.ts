import type { automation } from "@pulumi/pulumi";
import { type ExtraFields, WwlAutomatedDeployment } from "../../deployment";
import { awsRequirements } from "./requirements";

export abstract class WwlAwsBaseAutomatedDeployment extends WwlAutomatedDeployment {
  requirements = awsRequirements;
  // @ts-ignore No idea why typescript doesn't understand that this matches the type
  extraFields = ["awsRegion"];

  async onInitPulumiStack(pulumiStack: automation.Stack): Promise<void> {
    await pulumiStack.workspace.installPlugin("aws", "v6.47.0");
    await pulumiStack.setConfig("aws:region", { value: "us-west-2" });
  }
}
