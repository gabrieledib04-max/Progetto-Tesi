FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/ingestion-service/package.json ./services/ingestion-service/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY services/ingestion-service/ ./services/ingestion-service/

RUN npm run build --workspace=@eventspot/shared
RUN npm run build --workspace=@eventspot/ingestion-service

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/ingestion-service/package.json ./services/ingestion-service/
COPY --from=builder /app/services/ingestion-service/dist ./services/ingestion-service/dist

EXPOSE 3001

CMD ["node", "services/ingestion-service/dist/server.js"]
