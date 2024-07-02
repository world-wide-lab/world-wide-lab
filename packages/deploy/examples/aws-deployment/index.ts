import { WwlAwsDeployment } from '@world-wide-lab/deploy';

new WwlAwsDeployment({
  secrets: {
    // It's better if you change these to something matching your use case.
    dbUsername: "wwlDbUser",
    wwlAdminAuthDefaultEmail: "admin@world-wide-lab.org",
    // These should all be long and randomly generated.
    // See https://www.random.org/strings/?num=5&len=25&digits=on&upperalpha=on&loweralpha=on&format=html&rnd=new
    dbPassword: "",
    wwlAdminAuthDefaultPassword: "",
    wwlAdminAuthSessionSecret: "",
    wwlDefaultApiKey: "",
  }
});
