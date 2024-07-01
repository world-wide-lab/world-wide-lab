import { WwlAwsDeployment } from '@world-wide-lab/deploy';

new WwlAwsDeployment("my-wwl-deployment", {
  // secrets: {
    // dbUsername: "",
    // wwlAdminAuthDefaultEmail: "",
    // These should all be long and randomly generated.
    // See https://www.random.org/strings/?num=5&len=25&digits=on&upperalpha=on&loweralpha=on&format=html&rnd=new
    // dbPassword: "",
    // wwlAdminAuthDefaultPassword: "",
    // wwlAdminAuthSessionSecret: "",
    // wwlDefaultApiKey: "",
  // }
});
