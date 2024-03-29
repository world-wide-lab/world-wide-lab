import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import "dotenv/config";

const config = new pulumi.Config();
const containerPort = 80; // Default WWL port
const cpu = config.getNumber("cpu") || 256;
const memory = config.getNumber("memory") || 512;
const minCapacity = config.getNumber("minCapacity") || 1;
const maxCapacity = config.getNumber("maxCapacity") || 4;

const requiredEnvVars = [
  "DB_USERNAME",
  "WWL_ADMIN_AUTH_DEFAULT_EMAIL",
  "DB_PASSWORD",
  "WWL_ADMIN_AUTH_DEFAULT_PASSWORD",
  "WWL_ADMIN_AUTH_SESSION_SECRET",
  "WWL_DEFAULT_API_KEY",
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Please set ${envVar}`);
  }
}

// - Database -
const db = new aws.rds.Instance("wwl-database", {
  dbName: "wwl_db",
  engine: "postgres",
  engineVersion: "15",
  instanceClass: "db.t3.micro",
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  //  Either one of these two is required
  // skipFinalSnapshot: true,
  finalSnapshotIdentifier: "wwl-db-final-snapshot",
  deletionProtection: true,
});

const dbConnectionString = pulumi
  .all([db.endpoint, db.dbName])
  .apply(
    ([endpoint, dbName]) =>
      `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${endpoint}/${dbName}?sslmode=require&sslrootcert=/usr/src/app/certs/aws-rds-global-bundle.pem`,
  );
if (typeof dbConnectionString === "string") {
  console.log(`REMOVEME: DB Connection String: ${dbConnectionString}`);
}

// - App Runner -

// How should the app auto-scale itself?
const autoScalingConfig = new aws.apprunner.AutoScalingConfigurationVersion(
  "autoScalingConfig",
  {
    autoScalingConfigurationName: "wwl-server-auto-scaling-config",
    maxConcurrency: 100,
    minSize: minCapacity,
    maxSize: maxCapacity,
  },
);

// Allow the apprunner to connect to the database
const vpcConnector = new aws.apprunner.VpcConnector("wwl-vpc-connector", {
  vpcConnectorName: "name",
  // Use all subnets by default
  subnets: aws.ec2
    .getSubnets({
      filters: [],
    })
    .then((subnets) => subnets.ids),
  securityGroups: db.vpcSecurityGroupIds,
});

// Create the App Runner service itself, which runs the app / container
const appRunnerService = new aws.apprunner.Service("wwl-server-service", {
  serviceName: "wwl-server-service",
  sourceConfiguration: {
    autoDeploymentsEnabled: false,
    imageRepository: {
      imageIdentifier: "public.ecr.aws/g0k5o2x2/server:latest",
      imageRepositoryType: "ECR_PUBLIC",
      imageConfiguration: {
        port: containerPort.toString(),
        runtimeEnvironmentVariables: {
          NODE_ENV: "production",
          PORT: `${containerPort}`,
          DATABASE_URL: dbConnectionString,
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
    cpu: cpu.toString(),
    memory: memory.toString(),
  },
  autoScalingConfigurationArn: autoScalingConfig.arn,
  networkConfiguration: {
    egressConfiguration: {
      egressType: "VPC",
      vpcConnectorArn: vpcConnector.arn,
    },
  },
});

// The URL at which the container's HTTP endpoint will be available
const url = pulumi.interpolate`http://${appRunnerService.serviceUrl}`;
if (typeof url === "string") {
  console.log(`Running at: ${url}`);
}

export { url };
