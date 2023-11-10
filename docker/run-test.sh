npm run build
docker build -t ghcr.io/world-wide-lab/server:latest packages/server/
docker-compose -f docker/docker-compose.testing.yml down
docker-compose -f docker/docker-compose.testing.yml run test-server
