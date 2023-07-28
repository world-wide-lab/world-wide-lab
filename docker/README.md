# World-Wide-Lab Server Docker Container

The World-Wide-Lab server can be built as a docker container for easier and more reliable sharing and deployments.

## Using the Container

In its production version, the docker container forces you to specify some information for security reasons e.g. login credentials and a secret.

To run the production version of the server docker container, you can e.g. use the following snippet. Please note we are only using example values for the environment variables here: you should use always secure values for `ADMIN_AUTH_DEFAULT_EMAIL` and `ADMIN_AUTH_DEFAULT_PASSWORD` and a randomly generated value for `ADMIN_AUTH_SESSION_SECRET`. When running in production, we also suggest using a `postgres` database rather than a `sqlite` database.

```bash
docker run -p 8787:8787 \
  -e DATABASE_URL=sqlite://example.db \
  -e ADMIN_AUTH_DEFAULT_EMAIL="admin@admin.com" \
  -e ADMIN_AUTH_DEFAULT_PASSWORD="admin" \
  -e ADMIN_AUTH_SESSION_SECRET="asdfgh12345" \
  world-wide-lab/server
```

## Development

### Building the Container

To build the container, run the following command, which will build the docker container for your current platform.

```bash
# Build the latest version of the project
npm run build --prefix packages/server/
# Build the container
docker build -t world-wide-lab/server packages/server/
```

If you plan to deploy the container into the cloud, you may need to use `docker buildx` to build it for a different architecture as e.g. modern Macs use a different chip architecture compared to most cloud providers. You can build for the two most common architectures (amd64 and arm64) using the following command:

```bash
# Build the latest version of the project
npm run build --prefix packages/server/
# Build the container
docker buildx build -t world-wide-lab/server --platform=linux/amd64,linux/arm64/v8 packages/server/
```

### Pushing the Container to a Registry

By default we use the GitHub Container Registry: ghcr.io. To publish the container there, you will first need to tag it properly, then you can push it to the registry.

```bash
docker tag world-wide-lab/server ghcr.io/world-wide-lab/server:latest
docker push ghcr.io/world-wide-lab/server:latest
```

## Running Tests

```bash
docker-compose -f docker/docker-compose.testing.yml run test-server
docker-compose -f docker/docker-compose.testing.yml down
```
