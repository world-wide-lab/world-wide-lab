import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import "dotenv/config";

const config = new pulumi.Config();
const containerPort = 80; // Default WWL port
const cpu = config.getNumber("cpu") || 256;
const memory = config.getNumber("memory") || 256;

const requiredEnvVars = [
  "DB_USERNAME",
  "WWL_ADMIN_AUTH_DEFAULT_EMAIL",
  "DB_PASSWORD",
  "WWL_ADMIN_AUTH_DEFAULT_PASSWORD",
  "WWL_ADMIN_AUTH_SESSION_SECRET",
  "WWL_DEFAULT_API_KEY",
];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Please set ${envVar}`);
  }
});

// Database
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

// An ALB to serve the container endpoint to the internet
const loadbalancer = new awsx.lb.ApplicationLoadBalancer(
  "wwl-loadbalancer",
  {},
);

// An ECS cluster to deploy into
const cluster = new aws.ecs.Cluster("wwl-cluster", {});

// Deploy an ECS Service on Fargate to host the application container
const service = new awsx.ecs.FargateService("wwl-server-service", {
  cluster: cluster.arn,
  assignPublicIp: true,
  taskDefinitionArgs: {
    container: {
      name: "wwl-server",
      image: "ghcr.io/world-wide-lab/server:latest",
      cpu: cpu,
      memory: memory,
      essential: true,
      portMappings: [
        {
          hostPort: containerPort,
          containerPort: containerPort,
          targetGroup: loadbalancer.defaultTargetGroup,
        },
      ],
      environment: [
        { name: "NODE_ENV", value: "production" },
        { name: "PORT", value: `${containerPort}` },
        { name: "DATABASE_URL", value: dbConnectionString },
        { name: "ADMIN_UI", value: "true" },
        { name: "USE_AUTHENTICATION", value: "true" },
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

// The URL at which the container's HTTP endpoint will be available
const url = pulumi.interpolate`http://${loadbalancer.loadBalancer.dnsName}`;
if (typeof url === "string") {
  console.log(`Running at: ${url}`);
}

export { url };
