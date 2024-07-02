# Deploying World-Wide-Lab to the Cloud

This guide will walk you through the process of deploying World-Wide-Lab into the cloud. We will be using Pulumi to automatically create and configure all ressources for the cloud.

For now, we only have a guide for deploying to the AWS cloud. However, you can deploy World-Wide-Lab to any cloud provider you want and we plan to add guidance for deploying to other cloud providers in the future.

## Deploying to AWS

### Setup

#### 1. Installing Pulumi

First, you need to install Pulumi. Pulumi is a tool that allows you to create, deploy, and manage cloud infrastructure using code. You can install Pulumi by following the instructions on the [official Pulumi website](https://www.pulumi.com/docs/get-started/install/).

#### 2. Logging into Pulumi

After installing Pulumi, you need to "login", in order to tell it, where to store information about your deployment. You can either store this information online by setting up a Pulumi account or store it locally on your computer. To store it locally, run the following command:

```bash
pulumi login --local
```

#### 3. Installing the AWS CLI

Next, you need to install the AWS CLI, wich will be used to communicate with AWS. You can install the AWS CLI by following the instructions on the [official AWS website](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html).

#### 4. Configuring the AWS CLI

After installing the AWS CLI, you need to configure it by running the following command:

```bash
aws configure
```

#### 5. Installing Node.js

Next, you will need to install Node.js. You can install Node.js by following the instructions on the [official Node.js website](https://nodejs.org/en/download/).

#### 6. Downloading the Deployment Folder

Download the deployment folder from [⬇️ here](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2Fworld-wide-lab%2Fworld-wide-lab%2Ftree%2Fmain%2Fpackages%2Fdeploy%2Fexamples%2Faws-deployment). You can find the deployment folder in the World-Wide-Lab Repository under `packages/deploy/examples/aws-deployment`.

#### 7. Installing Dependencies

After downloading the deployment folder, navigate to the folder in your terminal and run the following command to install the dependencies:

```bash
npm install
```

#### 8. Configuring the Deployment

Before deploying World-Wide-Lab to the cloud, you need to configure the deployment. You can configure the deployment by editing the `index.ts` file in the deployment folder using a text editor.

You will need to provide information for all "secrets" in the file. This is all the information that will be used for authenticating with World-Wide-Lab afterwards. To keep participant data secure, you should not share this information and use passwords which are not easy to guess. You can generate random passwords [🎲 here](https://www.random.org/strings/?num=5&len=25&digits=on&upperalpha=on&loweralpha=on&format=html&rnd=new).

#### 9. Deploying

That's it, with everything set up you can now deploy World-Wide-Lab, by running the following command in your deployment folder:

```bash
npm run deploy
```

When run for the first time, you will be asked to provide a name for your new "stack". You can choose any name you like here. Next, you have the option to provide a password for it, this is used to encrypt the information about your deployment on your machine. It's also possible to use an empty password.

Pulumi will then tell you which resources it will create and ask you to confirm the deployment. After confirming, Pulumi will start creating the resources in the cloud. This can take a few minutes, especially when deploying for the first time.

After the deployment is finished, you will receive a URL where you can access World-Wide-Lab. You can now use this URL to log into World-Wide-Lab (under `/admin`) and start using it.
