# Backend (NestJS + Prisma) en etapas: dependencias -> compilar -> imagen final liviana.
# La imagen final solo lleva lo necesario para correr (sin herramientas de desarrollo).

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

# Solo las dependencias de producción (sin Jest, el CLI de Nest, etc.)
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# "npm run build" corre antes "prisma generate" (script prebuild) y después compila a dist/
RUN npm run build

# Etapa aparte que solo aplica las migraciones a la base y termina (la usa el servicio "migraciones" del compose).
FROM build AS migraciones
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001
RUN apk add --no-cache openssl && addgroup -S app && adduser -S app -G app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/salud >/dev/null || exit 1
CMD ["node", "dist/main"]
