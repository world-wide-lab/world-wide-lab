import { WwlAwsDeployment, WwlAzureDeployment } from "@world-wide-lab/deploy";
import dotenv from "dotenv";

// Load environment variables from a .env file
dotenv.config();

new WwlAzureDeployment({
  // Load from .env
  secret_dbUsername: process.env.DB_USERNAME as string,
  secret_dbPassword: process.env.DB_PASSWORD as string,
  secret_wwlAdminAuthDefaultEmail: process.env
    .WWL_ADMIN_AUTH_DEFAULT_EMAIL as string,
  secret_wwlAdminAuthDefaultPassword: process.env
    .WWL_ADMIN_AUTH_DEFAULT_PASSWORD as string,
  secret_wwlAdminAuthSessionSecret: process.env
    .WWL_ADMIN_AUTH_SESSION_SECRET as string,
  secret_wwlDefaultApiKey: process.env.WWL_DEFAULT_API_KEY as string,
});
