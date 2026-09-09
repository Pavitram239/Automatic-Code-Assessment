FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 g++ default-jdk ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server ./
RUN mkdir -p temp

ENV NODE_ENV=production
EXPOSE 3100

CMD ["node", "app.js"]
