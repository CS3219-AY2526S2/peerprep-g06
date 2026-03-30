FROM node:24-alpine

WORKDIR /repo/services/matching-service

COPY services/matching-service/package*.json ./

RUN npm ci

COPY services/matching-service/ ./
COPY shared/types.ts /repo/shared/types.ts
COPY shared/constants.ts /repo/shared/constants.ts

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 3003

CMD ["npm", "start"]
