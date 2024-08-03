import { WwlAwsDeployment } from "./aws/";
import { WwlAwsAppRunnerAutomatedDeployment } from "./aws/automatedDeployments/app-runner";

export const AutomatedDeployments = {
  aws: {
    appRunner: WwlAwsAppRunnerAutomatedDeployment,
  },
};

export { WwlAwsDeployment };
