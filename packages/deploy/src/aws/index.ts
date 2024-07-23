import merge from "deepmerge";
import dotenv from "dotenv";

import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

interface WwlAwsDeploymentConfig {
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

export class WwlAwsDeployment {
  readonly config: WwlAwsDeploymentConfig;
  readonly url: pulumi.Output<string>;
  readonly dbConnectionString: pulumi.Output<string>;
  readonly db: aws.rds.Instance;
  readonly autoScalingConfig: aws.apprunner.AutoScalingConfigurationVersion;
  readonly vpcConnector: aws.apprunner.VpcConnector;
  readonly appRunnerService: aws.apprunner.Service;
  readonly loadbalancer: awsx.lb.ApplicationLoadBalancer;
  readonly cluster: aws.ecs.Cluster;
  readonly service: awsx.ecs.FargateService;
  readonly scalingTarget: aws.appautoscaling.Target;
  readonly scalingPolicy: aws.appautoscaling.Policy;

  /**
   * Creates a new static website hosted on AWS.
   * @param name The _unique_ name of the resource.
   * @param config
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(config?: Partial<WwlAwsDeploymentConfig>) {
    // Load environment variables from a .env file
    dotenv.config();
    // Generate the final configuration by merging in defaults
    this.config = merge(
      {
        // Deployment Configuration
        containerPort: 80,
        cpu: 256,
        memory: 512,
        minCapacity: 1,
        maxCapacity: 4,

        // More sensitive parts of configuration
        secrets: {
          dbUsername: process.env.DB_USERNAME,
          dbPassword: process.env.DB_PASSWORD,
          wwlAdminAuthDefaultEmail: process.env.WWL_ADMIN_AUTH_DEFAULT_EMAIL,
          wwlAdminAuthDefaultPassword:
            process.env.WWL_ADMIN_AUTH_DEFAULT_PASSWORD,
          wwlAdminAuthSessionSecret: process.env.WWL_ADMIN_AUTH_SESSION_SECRET,
          wwlDefaultApiKey: process.env.WWL_DEFAULT_API_KEY,
        },
      },
      // @ts-ignore - unsure how to make ts happy here with <Partial> & deepmerge
      config,
    );

    // Check that no value in secrets is empty
    for (const [key, value] of Object.entries(this.config.secrets)) {
      if (!value) {
        throw new Error(`Please provide a value for the secret "${key}"`);
      }
    }

    // - Database -
    this.db = new aws.rds.Instance("wwl-database", {
      dbName: "wwl_db",
      engine: "postgres",
      engineVersion: "15",
      instanceClass: "db.t3.micro",
      username: this.config.secrets.dbUsername,
      password: this.config.secrets.dbPassword,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      //  Either one of these two is required
      // skipFinalSnapshot: true,
      finalSnapshotIdentifier: "wwl-db-final-snapshot",
      deletionProtection: true,
    });

    this.dbConnectionString = pulumi
      .all([this.db.endpoint, this.db.dbName])
      .apply(
        ([endpoint, dbName]) =>
          `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${endpoint}/${dbName}?sslmode=require&sslrootcert=/usr/src/app/certs/aws-rds-global-bundle.pem`,
      );

    // - App Runner -

    // How should the app auto-scale itself?
    this.autoScalingConfig = new aws.apprunner.AutoScalingConfigurationVersion(
      "autoScalingConfig",
      {
        autoScalingConfigurationName: "wwl-server-auto-scaling-config",
        maxConcurrency: 100,
        minSize: this.config.minCapacity,
        maxSize: this.config.maxCapacity,
      },
    );

    // Allow the apprunner to connect to the database
    this.vpcConnector = new aws.apprunner.VpcConnector("wwl-vpc-connector", {
      vpcConnectorName: "name",
      // Use all subnets by default
      subnets: aws.ec2
        .getSubnets({
          filters: [],
        })
        .then((subnets) => subnets.ids),
      securityGroups: this.db.vpcSecurityGroupIds,
    });

    // Create the App Runner service itself, which runs the app / container
    this.appRunnerService = new aws.apprunner.Service("wwl-server-service", {
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
              ADMIN_AUTH_DEFAULT_EMAIL: process.env
                .WWL_ADMIN_AUTH_DEFAULT_EMAIL as string,
              ADMIN_AUTH_DEFAULT_PASSWORD: process.env
                .WWL_ADMIN_AUTH_DEFAULT_PASSWORD as string,
              ADMIN_AUTH_SESSION_SECRET: process.env
                .WWL_ADMIN_AUTH_SESSION_SECRET as string,
              DEFAULT_API_KEY: process.env.WWL_DEFAULT_API_KEY as string,
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

    // - AWS ECS -

    // An ALB to serve the container endpoint to the internet
    this.loadbalancer = new awsx.lb.ApplicationLoadBalancer(
      "wwl-loadbalancer",
      {},
    );

    // An ECS cluster to deploy into
    this.cluster = new aws.ecs.Cluster("wwl-cluster", {});

    // Deploy an ECS Service on Fargate to host the application container
    this.service = new awsx.ecs.FargateService("wwl-server-service", {
      cluster: this.cluster.arn,
      assignPublicIp: true,
      forceNewDeployment: true,
      taskDefinitionArgs: {
        container: {
          name: "wwl-server",
          image: "ghcr.io/world-wide-lab/server:latest",
          cpu: this.config.cpu,
          memory: this.config.memory,
          essential: true,
          portMappings: [
            {
              hostPort: this.config.containerPort,
              containerPort: this.config.containerPort,
              targetGroup: this.loadbalancer.defaultTargetGroup,
            },
          ],
          environment: [
            { name: "NODE_ENV", value: "production" },
            { name: "PORT", value: `${this.config.containerPort}` },
            { name: "DATABASE_URL", value: this.dbConnectionString },
            { name: "ADMIN_UI", value: "true" },
            { name: "USE_AUTHENTICATION", value: "true" },
            { name: "REPLICATION_ROLE", value: "source" },
            {
              name: "ADMIN_AUTH_DEFAULT_EMAIL",
              value: process.env.WWL_ADMIN_AUTH_DEFAULT_EMAIL,
            },
            {
              name: "ADMIN_AUTH_DEFAULT_PASSWORD",
              value: process.env.WWL_ADMIN_AUTH_DEFAULT_PASSWORD,
            },
            {
              name: "ADMIN_AUTH_SESSION_SECRET",
              value: process.env.WWL_ADMIN_AUTH_SESSION_SECRET,
            },
            { name: "DEFAULT_API_KEY", value: process.env.WWL_DEFAULT_API_KEY },
            { name: "DATABASE_CHUNK_SIZE", value: "5000" },
            { name: "LOGGING_HTTP", value: "false" },
            { name: "LOGGING_SQL", value: "false" },
            // set to 'verbose' to show SQL & HTTP logs (if enabled)
            { name: "LOGGING_LEVEL_CONSOLE", value: "info" },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": "/ecs/wwl-server",
              "awslogs-region": "us-east-1",
              "awslogs-stream-prefix": "ecs",
              "awslogs-create-group": "true",
            },
          },
        },
      },
    });

    // Define an Application Auto Scaling Target. This specifies the ECS service we want to scale.
    this.scalingTarget = new aws.appautoscaling.Target(
      "app-scaling-target",
      {
        maxCapacity: this.config.maxCapacity,
        minCapacity: this.config.minCapacity,
        resourceId: pulumi.interpolate`service/${this.cluster.name}/${this.service.service.name}`, // Format is "service/clusterName/serviceName"
        scalableDimension: "ecs:service:DesiredCount",
        serviceNamespace: "ecs",
      },
      { dependsOn: [this.service] },
    );

    // Define Application Auto Scaling Policy. This specifies how the Target should be scaled.
    this.scalingPolicy = new aws.appautoscaling.Policy(
      "app-scaling-policy",
      {
        policyType: "TargetTrackingScaling",
        resourceId: this.scalingTarget.resourceId,
        scalableDimension: this.scalingTarget.scalableDimension,
        serviceNamespace: this.scalingTarget.serviceNamespace,
        targetTrackingScalingPolicyConfiguration: {
          targetValue: 80.0,
          predefinedMetricSpecification: {
            predefinedMetricType: "ECSServiceAverageCPUUtilization",
          },
        },
      },
      { dependsOn: [this.scalingTarget] },
    );

    // The URL at which the container's HTTP endpoint will be available
    this.url = pulumi.interpolate`http://${this.loadbalancer.loadBalancer.dnsName}`;
    if (typeof this.url === "string") {
      console.log(`Running at: ${this.url}`);
    }
  }
}
