FROM node:18

# Set meta information
LABEL org.opencontainers.image.description="Container image used to run tests against the World-Wide-Lab server"
LABEL org.opencontainers.image.licenses="NO_LICENSE_YET"

# Navigate to correct directory
WORKDIR /usr/src/app

env NODE_ENV=test

# Application files should be mounted via a volume and not copied for efficiency

# Run tests
CMD npm i && npm test
