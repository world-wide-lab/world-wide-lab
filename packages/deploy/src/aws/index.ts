import { WwlAwsAppRunnerDeployment } from "./stacks/app-runner";
import { WwlAwsEcsDeployment } from "./stacks/ecs";

export interface WwlAwsDeploymentConfig {
  containerPort: number;
  cpu: number;
  memory: number;
  minCapacity: number;
  maxCapacity: number;
  secrets: {
    dbUsername: string;
    dbPassword: string;
    wwlAdminAuthDefaultEmail: string;
    wwlAdminAuthDefaultPassword: string;
    wwlAdminAuthSessionSecret: string;
    wwlDefaultApiKey: string;
  };
}

export {
  WwlAwsAppRunnerDeployment,
  WwlAwsEcsDeployment,
  WwlAwsEcsDeployment as WwlAwsDeployment,
};
