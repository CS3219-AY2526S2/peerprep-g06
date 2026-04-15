FROM node:24-alpine AS base

WORKDIR /repo/services/collaboration-service

COPY services/collaboration-service/package*.json ./

FROM base AS dev

RUN npm ci

COPY services/collaboration-service/ ./
COPY shared/types.ts /repo/shared/types.ts

ENV NODE_ENV=development

CMD ["npm", "run", "dev"]

FROM base AS build

RUN npm ci

COPY services/collaboration-service/ ./
COPY shared/types.ts /repo/shared/types.ts

RUN npm run build

FROM base AS prod-deps

RUN npm ci --omit=dev

FROM node:24-alpine AS prod

WORKDIR /repo/services/collaboration-service

COPY services/collaboration-service/package*.json ./
COPY --from=prod-deps /repo/services/collaboration-service/node_modules ./node_modules
COPY --from=build /repo/services/collaboration-service/dist ./dist

ENV NODE_ENV=production

EXPOSE 3004

CMD ["npm", "start"]
