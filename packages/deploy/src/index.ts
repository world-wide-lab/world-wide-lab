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

import { WwlAwsDeployment } from "./aws/";
import { WwlAwsAppRunnerAutomatedDeployment } from "./aws/automatedDeployments/app-runner";
import { WwlAwsDeploymentConfig } from "./aws/pulumiDeployments/_base";
import { WwlAzureDeployment } from "./azure/";
import { WwlAzureDeploymentConfig } from "./azure/pulumiDeployments/container-app";

export const AutomatedDeployments = {
  aws_apprunner: WwlAwsAppRunnerAutomatedDeployment,
};

export {
  WwlAwsDeployment,
  WwlAwsDeploymentConfig,
  type WwlAwsAppRunnerAutomatedDeployment,
  WwlAzureDeployment,
  WwlAzureDeploymentConfig,
};
