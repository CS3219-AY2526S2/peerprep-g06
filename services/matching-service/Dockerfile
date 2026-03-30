FROM node:24-alpine AS base

WORKDIR /repo/services/matching-service

COPY services/matching-service/package*.json ./

FROM base AS dev

RUN npm ci

COPY services/matching-service/ ./
COPY shared/types.ts /repo/shared/types.ts
COPY shared/constants.ts /repo/shared/constants.ts

ENV NODE_ENV=development

CMD ["npm", "run", "dev"]

FROM base AS build

RUN npm ci

COPY services/matching-service/ ./
COPY shared/types.ts /repo/shared/types.ts
COPY shared/constants.ts /repo/shared/constants.ts

RUN npm run build

FROM base AS prod-deps

RUN npm ci --omit=dev

FROM node:24-alpine AS prod

WORKDIR /repo/services/matching-service

COPY services/matching-service/package*.json ./
COPY --from=prod-deps /repo/services/matching-service/node_modules ./node_modules
COPY --from=build /repo/services/matching-service/dist ./dist

ENV NODE_ENV=production

EXPOSE 3003

CMD ["npm", "start"]
