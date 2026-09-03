import { WwlAwsAppRunnerDeployment } from "./pulumiDeployments/app-runner";

// WwlAwsEcsDeployment is deliberately not re-exported here. It is the only
// thing in this package that pulls in @pulumi/awsx, which in turn drags in the
// AWS SDK v2 - together roughly 116 MB, all of it bundled into the desktop app
// even though no automated deployment uses the ECS stack (see #97).
//
// @pulumi/awsx is an optional peer dependency, so it is not installed unless
// asked for. To use the ECS deployment, install it and import the module
// directly:
//
//   npm install @pulumi/awsx
//   import { WwlAwsEcsDeployment } from "@world-wide-lab/deploy/dist/aws/pulumiDeployments/ecs.js";

export {
  WwlAwsAppRunnerDeployment,
  WwlAwsAppRunnerDeployment as WwlAwsDeployment,
};
