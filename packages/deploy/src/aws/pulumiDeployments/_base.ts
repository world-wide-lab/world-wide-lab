import merge from "deepmerge";
import dotenv from "dotenv";

import { Instance } from "@pulumi/aws/rds";
import * as pulumi from "@pulumi/pulumi";

import { WwlPulumiDeployment } from "../../deployment";
import { awsRequirements } from "../automatedDeployments/requirements";

export interface WwlAwsDeploymentConfig {
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
   * Whether to enable deletion protection for the database.
   */
  dbDeletionProtection?: boolean;

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

type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

type FlipOptional<T> = Required<Pick<T, OptionalKeys<T>>> &
  Partial<Omit<T, OptionalKeys<T>>> extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export abstract class WwlAwsBaseDeployment extends WwlPulumiDeployment {
  public readonly requirements = awsRequirements;

  readonly config: WwlAwsDeploymentConfig;
  readonly dbConnectionString: pulumi.Output<string>;
  readonly db: Instance;

  url: pulumi.Output<string>;

  /**
   * Base class for WWL AWS deployments via Pulumi.
   * @param name The _unique_ name of the resource.
   * @param config The configuration for this deployment.
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(config?: WwlAwsDeploymentConfig) {
    super();

    // Load environment variables from a .env file
    // TODO: Should this be moved somewhere else?
    dotenv.config();

    // Generate the final configuration by merging in defaults
    const defaultConfig: FlipOptional<WwlAwsDeploymentConfig> = {
      // Deployment Configuration
      containerPort: 80,
      cpu: 256,
      memory: 512,
      minCapacity: 1,
      maxCapacity: 4,

      dbDeletionProtection: true,

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

    // - Database -
    this.db = new Instance("wwl-database", {
      dbName: "wwl_db",
      engine: "postgres",
      engineVersion: "15",
      instanceClass: "db.t3.micro",
      username: this.config.secret_dbUsername,
      password: this.config.secret_dbPassword,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      //  Either one of these two is required
      // skipFinalSnapshot: true,
      finalSnapshotIdentifier: "wwl-db-final-snapshot",
      deletionProtection: this.config.dbDeletionProtection,
    });

    this.dbConnectionString = pulumi
      .all([this.db.endpoint, this.db.dbName])
      .apply(
        ([endpoint, dbName]) =>
          `postgresql://${this.config.secret_dbUsername}:${this.config.secret_dbPassword}@${endpoint}/${dbName}?sslmode=require&sslrootcert=/usr/src/app/certs/aws-rds-global-bundle.pem`,
      );
  }
}
