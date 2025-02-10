import * as azureNative from "@pulumi/azure-native";
import * as pulumi from "@pulumi/pulumi";

export interface WwlAzureDeploymentConfig {
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
   * The number of CPU units to allocate for the app.
   */
  cpu?: number;

  /**
   * The amount of memory (in MiB) to allocate for the app.
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

export class WwlAzureContainerAppDeployment {
  /**
   * Create a new deployment of WWL on AWS App Runner.
   * @param name The _unique_ name of the resource.
   * @param config The configuration for this deployment.
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(config?: WwlAzureDeploymentConfig) {
    // Create an Azure Resource Group
    const resourceGroup = new azureNative.resources.ResourceGroup(
      "wwl_resourceGroup",
    );

    // Create an Azure PostgreSQL Server
    const postgresServer = new azureNative.dbforpostgresql.Server(
      "wwl_postgresServer",
      {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        administratorLogin: config.secret_dbUsername,
        administratorLoginPassword: config.secret_dbPassword,
        version: "14",
        storage: {
          storageSizeGB: 15,
        },
        sku: {
          name: "Burstable_B1ms",
          tier: "Burstable",
        },
      },
    );

    // Create a database in the PostgreSQL server
    const db = new azureNative.dbforpostgresql.Database("wwl_db", {
      resourceGroupName: resourceGroup.name,
      serverName: postgresServer.name,
      charset: "utf8",
      collation: "utf8_general_ci",
    });

    // Get the connection string for the PostgreSQL server
    const dbConnectionString = pulumi
      .all([postgresServer.name, db.name])
      .apply(
        ([serverName, dbName]) =>
          `postgresql://${config.secret_dbUsername}:${config.secret_dbPassword}@${serverName}.postgres.database.azure.com/${dbName}?sslmode=require`,
      );

    // Create a container group
    // const containerGroup = new azureNative.containerinstance.ContainerGroup("containerGroup", {
    //     resourceGroupName: resourceGroup.name,
    //     location: resourceGroup.location,
    //     osType: "Linux",
    //     containers: [{
    //         name: "mycontainer",
    //         image: "nginx",
    //         resources: {
    //             requests: {
    //                 cpu: 1,
    //                 memoryInGB: 1.5,
    //             },
    //         },
    //         environmentVariables: [
    //           { name: "NODE_ENV", value: "production" },
    //           { name: "PORT", value: `${config.containerPort}` },
    //           { name: "DATABASE_URL", value: dbConnectionString },
    //           { name: "ADMIN_UI", value: "true" },
    //           { name: "USE_AUTHENTICATION", value: "true" },
    //           { name: "REPLICATION_ROLE", value: "source" },
    //           {
    //             name: "ADMIN_AUTH_DEFAULT_EMAIL",
    //             value: config.secret_wwlAdminAuthDefaultEmail,
    //           },
    //           {
    //             name: "ADMIN_AUTH_DEFAULT_PASSWORD",
    //             value: config.secret_wwlAdminAuthDefaultPassword,
    //           },
    //           {
    //             name: "ADMIN_AUTH_SESSION_SECRET",
    //             value: config.secret_wwlAdminAuthSessionSecret,
    //           },
    //           { name: "DEFAULT_API_KEY", value: config.secret_wwlDefaultApiKey },
    //           { name: "DATABASE_CHUNK_SIZE", value: "5000" },
    //           { name: "LOGGING_HTTP", value: "false" },
    //           { name: "LOGGING_SQL", value: "false" },
    //           { name: "LOGGING_LEVEL_CONSOLE", value: "info" },
    //         ],
    //     }],
    //     restartPolicy: "Always",
    //     ipAddress: {
    //         type: "Public",
    //         ports: [{
    //             port: config.containerPort,
    //             protocol: "TCP",
    //         }],
    //     },
    // });

    // Create a container app environment
    const containerAppEnvironment = new azureNative.app.ManagedEnvironment(
      "wwl_containerAppEnvironment",
      {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        // appLogsConfiguration: {
        //     destination: "log-analytics",
        //     logAnalyticsConfiguration: {
        //         customerId: "your-log-analytics-workspace-id",
        //         sharedKey: "your-log-analytics-shared-key",
        //     },
        // },
        // daprAIConnectionString: "your-dapr-ai-connection-string",
      },
    );

    // Create a container app
    const containerApp = new azureNative.app.ContainerApp("wwl_containerApp", {
      resourceGroupName: resourceGroup.name,
      managedEnvironmentId: containerAppEnvironment.id,
      configuration: {
        ingress: {
          external: true,
          targetPort: config.containerPort,
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
              cpu: 0.5,
              memory: "1Gi",
            },
            env: [
              { name: "NODE_ENV", value: "production" },
              { name: "PORT", value: `${config.containerPort}` },
              { name: "DATABASE_URL", value: dbConnectionString },
              { name: "ADMIN_UI", value: "true" },
              { name: "USE_AUTHENTICATION", value: "true" },
              { name: "REPLICATION_ROLE", value: "source" },
              {
                name: "ADMIN_AUTH_DEFAULT_EMAIL",
                value: config.secret_wwlAdminAuthDefaultEmail,
              },
              {
                name: "ADMIN_AUTH_DEFAULT_PASSWORD",
                value: config.secret_wwlAdminAuthDefaultPassword,
              },
              {
                name: "ADMIN_AUTH_SESSION_SECRET",
                value: config.secret_wwlAdminAuthSessionSecret,
              },
              {
                name: "DEFAULT_API_KEY",
                value: config.secret_wwlDefaultApiKey,
              },
              { name: "DATABASE_CHUNK_SIZE", value: "5000" },
              { name: "LOGGING_HTTP", value: "false" },
              { name: "LOGGING_SQL", value: "false" },
              { name: "LOGGING_LEVEL_CONSOLE", value: "info" },
            ],
          },
        ],
        scale: {
          minReplicas: 1,
          maxReplicas: 5,
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
