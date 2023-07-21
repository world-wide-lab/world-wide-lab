FROM node:18

# Set meta information
LABEL org.opencontainers.image.source="https://github.com/world-wide-lab/world-wide-lab"
LABEL org.opencontainers.image.description="Container image of the World-Wide-Lab server"
LABEL org.opencontainers.image.licenses="NO_LICENSE_YET"

# Copy application files
COPY ../dist /usr/app/dist
COPY ../static /usr/app/static
COPY ../package.json /usr/app

# Navigate to correct directory
WORKDIR /usr/app

# Install dependencies
RUN npm install --production

# Start application
CMD ["npm", "start"]
