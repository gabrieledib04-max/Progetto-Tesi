FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/recommendation-service/package.json ./services/recommendation-service/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY services/recommendation-service/ ./services/recommendation-service/

RUN npm run build --workspace=@eventspot/shared
RUN npm run build --workspace=@eventspot/recommendation-service

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/recommendation-service/package.json ./services/recommendation-service/
COPY --from=builder /app/services/recommendation-service/dist ./services/recommendation-service/dist

EXPOSE 3002

CMD ["node", "services/recommendation-service/dist/server.js"]
