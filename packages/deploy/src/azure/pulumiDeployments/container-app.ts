import merge from "deepmerge";
import dotenv from "dotenv";

import { ResourceGroup } from "@pulumi/azure-native/resources";
import { Server, Database, FirewallRule } from "@pulumi/azure-native/dbforpostgresql";
import { ManagedEnvironment, ContainerApp } from "@pulumi/azure-native/app";
import * as pulumi from "@pulumi/pulumi";
import { WwlPulumiDeployment } from "../../deployment";

export interface WwlAzureDeploymentConfig {
  /**
   * The location in which to deploy the app. Corresponds to an Azure region.
   */
  location?: string;
  /**
   * The username for the database connection.
   */
  secret_dbUsername: string;

  /**
   * The password for the database connection.
   */
  secret_dbPassword: string;

  /**
   * The default email for the WWL admin authentication.
   */
  secret_wwlAdminAuthDefaultEmail: string;

  /**
   * The default password for the WWL admin authentication.
   */
  secret_wwlAdminAuthDefaultPassword: string;

  /**
   * The session secret for the WWL admin authentication.
   */
  secret_wwlAdminAuthSessionSecret: string;

  /**
   * The default API key for the WWL application.
   */
  secret_wwlDefaultApiKey: string;

  /**
   * The port on which the container will listen.
   */
  containerPort?: number;

  /**
   * The number of CPU units to allocate for the app e.g. 0.5 for 0.5 CPU units.
   */
  cpu?: number;

  /**
   * The amount of memory (in MiB) to allocate for the app e.g. 1 for 1 Gibibyte.
   */
  memory?: number;

  /**
   * The minimum number of instances to run (for autoscaling).
   */
  minCapacity?: number;

  /**
   * The maximum number of instances to run (for autoscaling).
   */
  maxCapacity?: number;
}

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

type FlipOptional<T> = Required<Pick<T, OptionalKeys<T>>> &
  Partial<Omit<T, OptionalKeys<T>>> extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export class WwlAzureContainerAppDeployment extends WwlPulumiDeployment {
  readonly config: WwlAzureDeploymentConfig;
  readonly dbConnectionString: pulumi.Output<string>;

  url: pulumi.Output<string>;

  /**
   * Create a new deployment of WWL on AWS App Runner.
   * @param config The configuration for this deployment.
   * @param stackConfig The stack configuration for the pulumi stack (this is usually only needed in exceptional circumstances).
   */
  constructor(config?: WwlAzureDeploymentConfig, stackConfig?: any) {
    super();

    // Load environment variables from a .env file
    // TODO: Should this be moved somewhere else?
    dotenv.config();

    // Allow setting the location via the stack configuration (if it exists)
    // This is mainly for consistency with the behaviour of the AWS autoamted deployments,
    // where the region has to be set on the stack (not so in Azure)
    const defaultLocation = stackConfig?.location || "eastus";

    // Generate the final configuration by merging in defaults
    const defaultConfig: FlipOptional<WwlAzureDeploymentConfig> = {
      location: defaultLocation,
      // Deployment Configuration
      containerPort: 80,
      cpu: 0.5,
      memory: 1,
      minCapacity: 1,
      maxCapacity: 4,

      // More sensitive parts of configuration
      secret_dbUsername: process.env.DB_USERNAME,
      secret_dbPassword: process.env.DB_PASSWORD,
      secret_wwlAdminAuthDefaultEmail: process.env.WWL_ADMIN_AUTH_DEFAULT_EMAIL,
      secret_wwlAdminAuthDefaultPassword:
        process.env.WWL_ADMIN_AUTH_DEFAULT_PASSWORD,
      secret_wwlAdminAuthSessionSecret:
        process.env.WWL_ADMIN_AUTH_SESSION_SECRET,
      secret_wwlDefaultApiKey: process.env.WWL_DEFAULT_API_KEY,
    };

    this.config = merge(defaultConfig, config);

    // Check that no value in secrets is empty
    for (const [key, value] of Object.entries(this.config)) {
      if (key.startsWith("secret_") && !value) {
        throw new Error(`Please provide a value for the secret "${key}"`);
      }
    }

    // Conver potential strings to numbers (due to adminJs casting)
    const numericKeys = [
      "containerPort",
      "cpu",
      "memory",
      "minCapacity",
      "maxCapacity",
    ];
    for (const key of numericKeys) {
      if (typeof this.config[key] === "string") {
        this.config[key] = Number.parseFloat(this.config[key]);
      }
    }

    // Create an Azure Resource Group
    const resourceGroup = new ResourceGroup(
      "wwlResourceGroup",
      {
        location: this.config.location,
      },
    );

    // Create an Azure PostgreSQL Server
    const postgresServer = new Server(
      // Only lowercase letters, numbers and hypens are allowed in the server name
      "wwl-postgres-server",
      {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        administratorLogin: this.config.secret_dbUsername,
        administratorLoginPassword: this.config.secret_dbPassword,
        version: "14",
        storage: {
          storageSizeGB: 32,
        },
        sku: {
          name: "Standard_B1ms",
          tier: "Burstable",
        },
      },
    );

    // Create a database in the PostgreSQL server
    const db = new Database(
      // Only lowercase letters, numbers and hypens are allowed in the db name
      "wwl-db",
      {
        resourceGroupName: resourceGroup.name,
        serverName: postgresServer.name,
      },
    );

    // Add firewall rule to allow Azure services
    const firewallRule = new FirewallRule(
      "allowAzureServices",
      {
        resourceGroupName: resourceGroup.name,
        serverName: postgresServer.name,
        startIpAddress: "0.0.0.0",
        endIpAddress: "0.0.0.0", // Special case: 0.0.0.0 allows Azure services
      },
    );

    // Get the connection string for the PostgreSQL server
    const dbConnectionString = pulumi
      .all([postgresServer.name, db.name])
      .apply(
        ([serverName, dbName]) =>
          `postgresql://${this.config.secret_dbUsername}:${this.config.secret_dbPassword}@${serverName}.postgres.database.azure.com/${dbName}?sslmode=require`,
      );

    // Create a container app environment
    const containerAppEnvironment = new ManagedEnvironment(
      "wwl-containerapp-environment",
      {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
      },
    );

    // Create a container app
    const containerApp = new ContainerApp("wwl-containerapp", {
      resourceGroupName: resourceGroup.name,
      managedEnvironmentId: containerAppEnvironment.id,
      configuration: {
        ingress: {
          external: true,
          targetPort: this.config.containerPort,
        },
        registries: [],
        secrets: [],
      },
      template: {
        containers: [
          {
            name: "wwl-server-service",
            image: "ghcr.io/world-wide-lab/server:latest",
            resources: {
              cpu: this.config.cpu,
              memory: `${this.config.memory}Gi`,
            },
            env: [
              { name: "NODE_ENV", value: "production" },
              { name: "PORT", value: `${this.config.containerPort}` },
              { name: "DATABASE_URL", value: dbConnectionString },
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
              { name: "LOGGING_LEVEL_CONSOLE", value: "info" },
            ],
          },
        ],
        scale: {
          minReplicas: this.config.minCapacity,
          maxReplicas: this.config.maxCapacity,
          rules: [
            {
              name: "http-scaling-rule",
              http: {
                metadata: {
                  concurrentRequests: "50",
                },
              },
            },
          ],
        },
      },
    });

    // The URL at which the container's HTTP endpoint will be available
    const url = pulumi.interpolate`https://${containerApp.name}.${containerAppEnvironment.defaultDomain}`;
    if (typeof url === "string") {
      console.log(`Running at: ${url}`);
    }
  }
}
