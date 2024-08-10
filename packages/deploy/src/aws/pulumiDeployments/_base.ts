import merge from "deepmerge";
import dotenv from "dotenv";

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { WwlPulumiDeployment } from "../../deployment";
import { awsRequirements } from "../automatedDeployments/requirements";

export interface WwlAwsDeploymentConfig {
  containerPort: number;
  cpu: number;
  memory: number;
  minCapacity: number;
  maxCapacity: number;

  dbDeletionProtection: boolean;

  secret_dbUsername: string;
  secret_dbPassword: string;
  secret_wwlAdminAuthDefaultEmail: string;
  secret_wwlAdminAuthDefaultPassword: string;
  secret_wwlAdminAuthSessionSecret: string;
  secret_wwlDefaultApiKey: string;
}

export abstract class WwlAwsBaseDeployment extends WwlPulumiDeployment {
  public readonly requirements = awsRequirements;

  readonly config: WwlAwsDeploymentConfig;
  readonly dbConnectionString: pulumi.Output<string>;
  readonly db: aws.rds.Instance;

  url: pulumi.Output<string>;

  /**
   * Creates a new static website hosted on AWS.
   * @param name The _unique_ name of the resource.
   * @param config
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(config?: Partial<WwlAwsDeploymentConfig>) {
    super();

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

        dbDeletionProtection: true,

        // More sensitive parts of configuration
        secret_dbUsername: process.env.DB_USERNAME,
        secret_dbPassword: process.env.DB_PASSWORD,
        secret_wwlAdminAuthDefaultEmail:
          process.env.WWL_ADMIN_AUTH_DEFAULT_EMAIL,
        secret_wwlAdminAuthDefaultPassword:
          process.env.WWL_ADMIN_AUTH_DEFAULT_PASSWORD,
        secret_wwlAdminAuthSessionSecret:
          process.env.WWL_ADMIN_AUTH_SESSION_SECRET,
        secret_wwlDefaultApiKey: process.env.WWL_DEFAULT_API_KEY,
      },
      // @ts-ignore - unsure how to make ts happy here with <Partial> & deepmerge
      config,
    );

    // Check that no value in secrets is empty
    for (const [key, value] of Object.entries(this.config)) {
      if (key.startsWith("secret_") && !value) {
        throw new Error(`Please provide a value for the secret "${key}"`);
      }
    }

    // - Database -
    this.db = new aws.rds.Instance("wwl-database", {
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
          `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${endpoint}/${dbName}?sslmode=require&sslrootcert=/usr/src/app/certs/aws-rds-global-bundle.pem`,
      );
  }
}
