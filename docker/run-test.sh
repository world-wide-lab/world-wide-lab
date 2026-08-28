#!/usr/bin/env bash
set -euo pipefail

# Build the container from the repository root (the server itself is built
# inside the container)
docker build -t ghcr.io/world-wide-lab/server:latest .

# The container runs as an unprivileged user, so the directory for the server
# logs has to be writable for it
mkdir -p packages/test-server/server-logs
chmod 777 packages/test-server/server-logs 2>/dev/null || true

docker compose -f docker/docker-compose.testing.yml down
docker compose -f docker/docker-compose.testing.yml run --rm test-server
