import { Policy, Target } from "@pulumi/aws/appautoscaling";
import { Cluster } from "@pulumi/aws/ecs";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

import { WwlAwsBaseDeployment, type WwlAwsDeploymentConfig } from "./_base";

export class WwlAwsEcsDeployment extends WwlAwsBaseDeployment {
  readonly loadbalancer: awsx.lb.ApplicationLoadBalancer;
  readonly cluster: Cluster;
  readonly service: awsx.ecs.FargateService;
  readonly scalingTarget: Target;
  readonly scalingPolicy: Policy;

  /**
   * Create a new deployment of WWL on AWS ECS.
   * @param name The _unique_ name of the resource.
   * @param config The configuration for this deployment.
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(config?: WwlAwsDeploymentConfig) {
    super(config);

    // An ALB to serve the container endpoint to the internet
    this.loadbalancer = new awsx.lb.ApplicationLoadBalancer(
      "wwl-loadbalancer",
      {},
    );

    // An ECS cluster to deploy into
    this.cluster = new Cluster("wwl-cluster", {});

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
              value: this.config.secret_wwlAdminAuthDefaultEmail,
            },
            {
              name: "ADMIN_AUTH_DEFAULT_PASSWORD",
              value: this.config.secret_wwlAdminAuthDefaultPassword,
            },
            {
              name: "ADMIN_AUTH_SESSION_SECRET",
              value: this.config.secret_wwlAdminAuthSessionSecret,
            },
            {
              name: "DEFAULT_API_KEY",
              value: this.config.secret_wwlDefaultApiKey,
            },
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
    this.scalingTarget = new Target(
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
    this.scalingPolicy = new Policy(
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
    this.url.apply((url) => {
      pulumi.log.info(`Running at: ${url}`);
    });
  }
}
