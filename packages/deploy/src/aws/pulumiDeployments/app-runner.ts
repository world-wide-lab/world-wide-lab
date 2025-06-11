import {
  AutoScalingConfigurationVersion,
  Service,
  VpcConnector,
} from "@pulumi/aws/apprunner";
import { getSubnets } from "@pulumi/aws/ec2";
import * as pulumi from "@pulumi/pulumi";

import { WwlAwsBaseDeployment, type WwlAwsDeploymentConfig } from "./_base";

export class WwlAwsAppRunnerDeployment extends WwlAwsBaseDeployment {
  readonly autoScalingConfig: AutoScalingConfigurationVersion;
  readonly vpcConnector: VpcConnector;
  readonly appRunnerService: Service;

  /**
   * Create a new deployment of WWL on AWS App Runner.
   * @param name The _unique_ name of the resource.
   * @param config The configuration for this deployment.
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(config?: WwlAwsDeploymentConfig) {
    super(config);

    // How should the app auto-scale itself?
    this.autoScalingConfig = new AutoScalingConfigurationVersion(
      "autoScalingConfig",
      {
        autoScalingConfigurationName: "wwl-server-auto-scaling-config",
        maxConcurrency: 100,
        minSize: this.config.minCapacity,
        maxSize: this.config.maxCapacity,
      },
    );

    // Allow the apprunner to connect to the database
    this.vpcConnector = new VpcConnector("wwl-vpc-connector", {
      vpcConnectorName: "name",
      // Use all subnets by default
      subnets: getSubnets({
        filters: [],
      }).then((subnets) => subnets.ids),
      securityGroups: this.db.vpcSecurityGroupIds,
    });

    // Create the App Runner service itself, which runs the app / container
    this.appRunnerService = new Service("wwl-server-service", {
      serviceName: "wwl-server-service",
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: "public.ecr.aws/g0k5o2x2/server:latest",
          imageRepositoryType: "ECR_PUBLIC",
          imageConfiguration: {
            port: this.config.containerPort.toString(),
            runtimeEnvironmentVariables: {
              NODE_ENV: "production",
              PORT: `${this.config.containerPort}`,
              DATABASE_URL: this.dbConnectionString,
              ADMIN_UI: "true",
              USE_AUTHENTICATION: "true",
              REPLICATION_ROLE: "source",
              ADMIN_AUTH_DEFAULT_EMAIL:
                this.config.secret_wwlAdminAuthDefaultEmail,
              ADMIN_AUTH_DEFAULT_PASSWORD:
                this.config.secret_wwlAdminAuthDefaultPassword,
              ADMIN_AUTH_SESSION_SECRET:
                this.config.secret_wwlAdminAuthSessionSecret,
              DEFAULT_API_KEY: this.config.secret_wwlDefaultApiKey,
              DATABASE_CHUNK_SIZE: "5000",
              LOGGING_HTTP: "false",
              LOGGING_SQL: "false",
              LOGGING_LEVEL_CONSOLE: "info",
            },
          },
        },
      },
      instanceConfiguration: {
        cpu: this.config.cpu.toString(),
        memory: this.config.memory.toString(),
      },
      autoScalingConfigurationArn: this.autoScalingConfig.arn,
      networkConfiguration: {
        egressConfiguration: {
          egressType: "VPC",
          vpcConnectorArn: this.vpcConnector.arn,
        },
      },
    });

    // The URL at which the container's HTTP endpoint will be available
    this.url = pulumi.interpolate`http://${this.appRunnerService.serviceUrl}`;
    this.url.apply((url) => {
      pulumi.log.info(`Running at: ${url}`);
    });
  }
}
