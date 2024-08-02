import { WwlAwsAppRunnerDeployment } from "./app-runner";
import { WwlAwsEcsDeployment } from "./ecs";

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

// TODO: Both classes above are very similar. Could be refactored to share common logic.
export {
  WwlAwsAppRunnerDeployment,
  WwlAwsEcsDeployment,
  WwlAwsEcsDeployment as WwlAwsDeployment,
};
