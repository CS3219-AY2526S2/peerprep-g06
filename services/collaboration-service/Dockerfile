FROM node:24-alpine

WORKDIR /

# Copy and build the shared rabbitmq module
COPY shared/rabbitmq /shared/rabbitmq
RUN cd /shared/rabbitmq && rm -rf node_modules && npm install --include=dev && ./node_modules/.bin/tsc

WORKDIR /app

COPY services/collaboration-service/package*.json ./

RUN npm ci

COPY services/collaboration-service/ .

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 3004

CMD ["npm", "start"]
