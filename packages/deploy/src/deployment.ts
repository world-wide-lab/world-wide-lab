import { automation } from "@pulumi/pulumi";
import type { Requirement } from "./requirements";

import merge from "deepmerge";

// This correspondes to a classic pulumi program.
// These should also be usable on their own with the pulumi CLI.
export abstract class WwlPulumiDeployment {}

type StackConfiguration = {
  PULUMI_CONFIG_PASSPHRASE: string;
};

// This is the base class for all automated deployments.
// It's expected to be called from within the WWL Desktop App.
export abstract class WwlAutomatedDeployment {
  // A list of requirements for this automated deployment
  abstract requirements: Requirement[];
  abstract defaultStackConfiguration: { [key: string]: string };
  // The Pulumi deployment itself (note that this is a class, not an instance)
  abstract PulumiDeployment: typeof WwlPulumiDeployment;

  // Handling & Initializing the Pulumi stack
  abstract onInitPulumiStack(
    pulumiStack: automation.Stack,
    combinedStackConfiguration: StackConfiguration &
      typeof this.defaultStackConfiguration,
  ): Promise<void>;

  private pulumiStack: automation.Stack;

  async initStack(
    projectName: string,
    stackName: string,
    stackConfiguration: Partial<StackConfiguration>,
    deploymentConfiguration: { [key: string]: string },
  ) {
    console.log("Initializing Pulumi Stack with config:", {
      projectName,
      stackName,
      stackConfiguration,
      deploymentConfiguration,
    });

    // Stack Configuration
    // Merge the overall default stack configuration,
    // with the default of the stack itself
    // and the user stack configuration
    const combinedStackConfiguration: any = merge.all([
      // Overall default
      {
        PULUMI_CONFIG_PASSPHRASE: "",
      } as StackConfiguration,
      // Stack default
      this.defaultStackConfiguration,
      // User configuration
      stackConfiguration,
    ]);

    const inlineProgramArgs: automation.InlineProgramArgs = {
      projectName,
      stackName,
      program: async () => {
        // @ts-ignore - ts seems to not be able to comprehend, that this can be overwritten
        await new this.PulumiDeployment(
          deploymentConfiguration,
          stackConfiguration,
        );
      },
    };

    const pulumiStack = await automation.LocalWorkspace.createOrSelectStack(
      inlineProgramArgs,
      {
        envVars: {
          PULUMI_CONFIG_PASSPHRASE:
            combinedStackConfiguration.PULUMI_CONFIG_PASSPHRASE,
        },
      },
    );
    this.pulumiStack = pulumiStack;

    // Check whether the deployment itself has any special requirements
    await this.onInitPulumiStack(pulumiStack, combinedStackConfiguration);

    console.log(
      `Pulumi Stack initialized in: ${pulumiStack.workspace.workDir}`,
    );
  }

  // It's important that refresh gets called before other commands
  async refresh(pulumiOpts?: automation.RefreshOptions) {
    return await this.pulumiStack.refresh(pulumiOpts);
  }

  async preview(pulumiOpts?: automation.PreviewOptions) {
    await this.pulumiStack.refresh();

    return await this.pulumiStack.preview(pulumiOpts);
  }

  async deploy(pulumiOpts?: automation.UpOptions) {
    await this.pulumiStack.refresh();

    return await this.pulumiStack.up(pulumiOpts);
  }

  async remove(pulumiOpts?: automation.DestroyOptions) {
    await this.pulumiStack.refresh();

    const name = this.pulumiStack.name;
    const result = await this.pulumiStack.destroy(pulumiOpts);
    await this.pulumiStack.workspace.removeStack(name);

    if (result.stdout.includes("pulumi stack rm")) {
      result.stdout +=
        "\n\nHistory and configuration of this stack have also been deleted.";
    }

    return result;
  }
}
