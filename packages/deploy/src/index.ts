import { WwlAwsDeployment } from "./aws/";
import { WwlAwsAppRunnerAutomatedDeployment } from "./aws/automatedDeployments/app-runner";

export const AutomatedDeployments = {
  aws_apprunner: WwlAwsAppRunnerAutomatedDeployment,
};

export { WwlAwsDeployment };
