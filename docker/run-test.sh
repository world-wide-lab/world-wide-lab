npm run build
docker build -t world-wide-lab/server packages/wwl/
docker-compose -f docker/docker-compose.testing.yml down
docker-compose -f docker/docker-compose.testing.yml run test-server
