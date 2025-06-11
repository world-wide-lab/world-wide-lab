import { WwlAwsDeployment } from "@world-wide-lab/deploy";

new WwlAwsDeployment({
  // It's better if you change these to something matching your use case.
  secret_dbUsername: "wwlDbUser",
  secret_wwlAdminAuthDefaultEmail: "admin@world-wide-lab.org",

  // These should all be long and randomly generated.
  // See https://www.random.org/strings/?num=5&len=25&digits=on&upperalpha=on&loweralpha=on&format=html&rnd=new
  secret_dbPassword: "",
  secret_wwlAdminAuthDefaultPassword: "",
  secret_wwlAdminAuthSessionSecret: "",
  secret_wwlDefaultApiKey: "",

  // By default, we protect the database from deletion to protect against data loss.
  // Set this to false to be able to delete the database.
  dbDeletionProtection: false,
});
