import type { WwlPulumiDeployment } from "../../deployment";
import { WwlAwsAppRunnerDeployment } from "../pulumiDeployments/app-runner";
import { WwlAwsBaseAutomatedDeployment } from "./_base";

export class WwlAwsAppRunnerAutomatedDeployment extends WwlAwsBaseAutomatedDeployment {
  PulumiDeployment: typeof WwlPulumiDeployment = WwlAwsAppRunnerDeployment;
}
