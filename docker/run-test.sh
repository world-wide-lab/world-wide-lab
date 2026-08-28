#!/usr/bin/env bash
set -euo pipefail

# Build the container (the server itself is built inside the container)
docker build -t ghcr.io/world-wide-lab/server:latest packages/server/

docker compose -f docker/docker-compose.testing.yml down
docker compose -f docker/docker-compose.testing.yml run --rm test-server
