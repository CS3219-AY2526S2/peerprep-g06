FROM node:18-alpine

WORKDIR /

# Copy and build the shared rabbitmq module
COPY shared/rabbitmq /shared/rabbitmq
RUN cd /shared/rabbitmq && rm -rf node_modules && npm install --include=dev && ./node_modules/.bin/tsc

WORKDIR /app

# Copy package.json (not lock file — file: paths differ in container)
COPY services/matching-service/package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY services/matching-service/ .

# Expose matching service port
EXPOSE 3003

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "dev"]
