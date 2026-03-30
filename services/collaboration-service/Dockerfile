FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS dev

RUN npm ci

COPY . .

ENV NODE_ENV=development

CMD ["npm", "run", "dev"]

FROM base AS build

RUN npm ci

COPY . .

RUN npm run build

FROM base AS prod-deps

RUN npm ci --omit=dev

FROM node:24-alpine AS prod

WORKDIR /app

COPY package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 3004

CMD ["npm", "start"]
