import merge from "deepmerge";
import dotenv from "dotenv";

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

import { WwlPulumiDeployment } from "../../deployment";
import { awsRequirements } from "../requirements";

export interface WwlAwsDeploymentConfig {
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
  }
}
