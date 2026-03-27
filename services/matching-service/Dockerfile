FROM node:18-alpine

WORKDIR /

# Copy and build the shared rabbitmq module
COPY shared/rabbitmq /shared/rabbitmq
RUN cd /shared/rabbitmq && npm install && npm run build

WORKDIR /app

# Copy package files
COPY services/matching-service/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY services/matching-service/ .

# Expose matching service port
EXPOSE 3003

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "dev"]
