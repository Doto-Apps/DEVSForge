# Utilise une image Node.js légère
FROM node:20-alpine AS builder

# Crée un répertoire de travail
WORKDIR /app

# Copie uniquement les fichiers nécessaires pour l'installation
COPY package.json pnpm-lock.yaml ./

# Installe les dépendances
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]