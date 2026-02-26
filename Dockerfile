FROM node:20-bullseye-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM node:20-bullseye-slim AS backend-build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

FROM node:20-bullseye-slim

WORKDIR /app

COPY --from=backend-build /app /app
COPY --from=frontend-build /frontend/dist /app/public

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.js"]
