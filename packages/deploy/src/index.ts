/**
 * A helper package to deploy World Wide Lab into the cloud.
 *
 * @remarks
 * We recommend to only make use of this package if you have experience with
 * deploying applications to the cloud. For anyone else, we recommend using
 * the "Deployments" panel in the World Wide Lab Desktop App.
 *
 * @packageDocumentation
 */

import { WwlAwsAppRunnerAutomatedDeployment } from "./aws/automatedDeployments/app-runner";
import { WwlAwsDeploymentConfig } from "./aws/pulumiDeployments/_base";
// Imported from the module directly rather than through ./aws/, whose barrel
// also pulls in the ECS deployment and with it @pulumi/awsx + the AWS SDK v2.
// Nothing here uses the ECS stack, and loading it costs the desktop app well
// over 100 MB (see #97). ./aws/ still exports it for anyone importing this
// package as a library.
import { WwlAwsAppRunnerDeployment as WwlAwsDeployment } from "./aws/pulumiDeployments/app-runner";
import { WwlAzureDeployment } from "./azure/";
import { WwlAzureContainerAppAutomatedDeployment } from "./azure/automatedDeployments/container-app";
import { WwlAzureDeploymentConfig } from "./azure/pulumiDeployments/container-app";

export const AutomatedDeployments = {
  aws_apprunner: WwlAwsAppRunnerAutomatedDeployment,
  azure_containerapp: WwlAzureContainerAppAutomatedDeployment,
};

export {
  WwlAwsDeployment,
  WwlAwsDeploymentConfig,
  type WwlAwsAppRunnerAutomatedDeployment,
  WwlAzureDeployment,
  WwlAzureDeploymentConfig,
};
