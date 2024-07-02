# Deploying World-Wide-Lab to the Cloud

This guide will walk you through the process of deploying World-Wide-Lab into the cloud.

For now, we only have a guide for deploying to [Amazon Web Services (AWS)](https://aws.amazon.com/). However, with a bit of experience, you can deploy World-Wide-Lab to any cloud provider you want and we plan to add guidance for deploying to other cloud providers in the future.

### What are we trying to deploy?

![A diagram showing the World-Wide-Lab architecture in the cloud: the World-Wide-Lab instance itself and a database instance it's connecting to.](/img/diagrams/cloud.png)

There are two components to any cloud deployment of World-Wide-Lab: An instance of the World-Wide-Lab software itself and a Postgres database to store its data.

By default, we configure our deployments in such a way that the database is only accessible to the World-Wide-Lab instance and only the World-Wide-Lab instance is accessible from the internet.

## Deploying to AWS

The following is a step-by-step guide to deploying World-Wide-Lab on the [AWS cloud](https://aws.amazon.com/). We are using [Pulumi](https://www.pulumi.com/) to automatically create and configure all ressources for the cloud provider.

While this guide has quite a few steps for its setup, it has the benefit of being able to automatically handle the deployment and configuration in a single step at the end. After the initial setup, it's also easy to delete or update the deployment again via Pulumi.

### Setup

#### Setting up Pulumi

First, you will need to install Pulumi. Pulumi is a tool that allows you to create, deploy, and manage cloud infrastructure using code. You can install Pulumi by following the instructions on the [official Pulumi website](https://www.pulumi.com/docs/install/).

After installing Pulumi, you need to "login", in order to tell it where to store information about your deployment. You can either store this information online by setting up a Pulumi account or store it locally on your computer. To store it locally, run the following command in your terminal.

```bash
pulumi login --local
```

#### Setting up the AWS CLI

Next, you need to install the AWS CLI, wich will be used to authenticate and communicate with AWS. You can install the AWS CLI by following the instructions on the [official AWS website](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

After installing the AWS CLI, you need to authenticate yourself with it. You can do this by running the following command in your terminal and entering your credentials.

```bash
aws configure
```

You can get the credentials as follows:

1. Go to your [account console](console.aws.amazon.com).
2. Click on the top-right corner, where youre account name is written.
3. Click on "Security credentials".
4. Create a new access key and copy the access key ID and secret access key.

#### Installing Node.js

Next, you will need to install Node.js. This is a piece of software we need to evaluate the cloud configuration in Pulumi.

You can install Node.js by following the instructions on the [official Node.js website](https://nodejs.org/en/download/). This will add a new `npm` command to your terminal, which we will use in the next steps.

#### Preparing the Deployment

Now, you will need to download the deployment folder from [⬇️ here](https://download-directory.github.io/?url=https%3A%2F%2Fgithub.com%2Fworld-wide-lab%2Fworld-wide-lab%2Ftree%2Fmain%2Fpackages%2Fdeploy%2Fexamples%2Faws-deployment). This folder contains all the information and configuration to specify what we want to deploy. (You can also find the deployment folder in the World-Wide-Lab Repository under `packages/deploy/examples/aws-deployment`)

After downloading the deployment folder, navigate to the folder in your terminal and run the following command to install all its dependencies.

```bash
npm install
```

Now you're almost done! 🎉

Before deploying World-Wide-Lab to the cloud, you will only need to configure the deployment, adding your own authentication credentials (so only **you** have access to it and its data). You can configure the deployment by editing the `index.ts` file in the deployment folder using a text editor.

You will need to provide information for all "secrets" in the file. This is all the information that will be used for authenticating with World-Wide-Lab afterwards. To keep participant data secure, you should not share this information and use passwords which are not easy to guess. You can generate random passwords [🎲 here](https://www.random.org/strings/?num=5&len=25&digits=on&upperalpha=on&loweralpha=on&format=html&rnd=new).

#### Deploying 🚀

That's it, with everything set up you can now deploy World-Wide-Lab, by running the following command in your deployment folder:

```bash
npm run deploy
```

When run for the first time, you will be asked to provide a name for your new "stack". You can choose any name you like here. Next, you have the option to provide a password for it, this is used to encrypt the information about your deployment on your machine. It's also possible to use an empty password.

Pulumi will then tell you which resources it will create and ask you to confirm the deployment. After confirming, Pulumi will start creating the resources in the cloud. This can take a few minutes, especially when deploying for the first time.

After the deployment is finished, you will receive a URL where you can access World-Wide-Lab. You can now use this URL to log into World-Wide-Lab (under `/admin`) and start using it.

## Manual Deployments

If you have experience with Docker, you can also easily deploy World-Wide-Lab yourself. You will only need to run the Docker container and provide it with a connection to a Postgres database. You can find the Docker images for World-Wide-Lab on the [GitHub Container Registry](https://github.com/world-wide-lab/world-wide-lab/pkgs/container/server).

We also reccomend taking a look at the example [docker compose file](https://github.com/world-wide-lab/world-wide-lab/blob/main/docker/docker-compose.yml) in the World-Wide-Lab repository, which contains a working configuration of World-Wide-Lab and a Postgres database.
