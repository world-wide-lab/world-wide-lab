FROM node:18

# Set meta information
LABEL org.opencontainers.image.source="https://github.com/world-wide-lab/world-wide-lab"
LABEL org.opencontainers.image.description="Container image of the World-Wide-Lab server"
LABEL org.opencontainers.image.licenses="NO_LICENSE_YET"

# Navigate to correct directory
WORKDIR /usr/src/app

env NODE_ENV=production

# Install dependencies
COPY package.json ./
# TODO: Use a lockfile here (will require a switch away from npm as package manager)
RUN npm install --omit=dev

# Copy application files
COPY dist ./dist
COPY static ./static

# Expose the app's port
ENV PORT=8787
EXPOSE 8787

# Start application
CMD ["npm", "start-only"]
