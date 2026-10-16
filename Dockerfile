# Estágio de build: gera o estático com o mesmo Node do CI.
FROM node:24.22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Imagem final: Nginx já rodando sem root (usuário 101) e escutando na 8080.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine

COPY --chmod=0755 docker/10-api-upstream.envsh /docker-entrypoint.d/10-api-upstream.envsh
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
