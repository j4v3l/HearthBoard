FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24.18.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/hearthboard.db

RUN apt-get update \
  && apt-get install -y --no-install-recommends iputils-ping \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server

RUN mkdir -p /data \
  && chown node:node /data

USER node
EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "server/index.js"]
