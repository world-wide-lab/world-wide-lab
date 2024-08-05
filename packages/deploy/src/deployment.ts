import { automation } from "@pulumi/pulumi";
import type { Requirement } from "./requirements";

// This correspondes to a classic pulumi program.
// These should also be usable on their own with the pulumi CLI.
export class WwlPulumiDeployment {}

export type ExtraFields = "awsRegion";

// This is the base class for all automated deployments.
// It's expected to be called from within the WWL Desktop App.
export abstract class WwlAutomatedDeployment {
  abstract requirements: Requirement[];
  abstract PulumiDeployment: typeof WwlPulumiDeployment;
  abstract onInitPulumiStack(pulumiStack: automation.Stack): Promise<void>;
  extraFields: ExtraFields[] = [];

  // Initialize the Pulumi stack
  private pulumiStack: automation.Stack;
  async initStack(projectName: string, stackName: string) {
    const pulumiStack = await automation.LocalWorkspace.createOrSelectStack(
      {
        projectName,
        stackName,
        program: async () => await new this.PulumiDeployment(),
      },
      {
        envVars: {
          // TODO: Make this configurable?
          PULUMI_CONFIG_PASSPHRASE: "",
        },
      },
    );
    this.pulumiStack = pulumiStack;

    // Check whether the deployment itself has any special requirements
    await this.onInitPulumiStack(pulumiStack);
  }

  async refresh() {
    return await this.pulumiStack.refresh();
  }

  async preview() {
    return await this.pulumiStack.preview();
  }

  async deploy() {
    return await this.pulumiStack.up();
  }

  async remove() {
    const name = this.pulumiStack.name;
    await this.pulumiStack.destroy();
    await this.pulumiStack.workspace.removeStack(name);
  }
}
