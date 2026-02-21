FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE ${REDIS_PORT}

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "dev"]