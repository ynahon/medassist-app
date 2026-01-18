FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install 

COPY tsconfig.server.json ./
COPY server ./server
COPY shared ./shared

RUN npx tsc --project tsconfig.server.json

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/templates ./server/templates

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server/index.js"]