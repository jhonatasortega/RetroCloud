FROM node:22-alpine

WORKDIR /app

# Copiar package.json e pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm e dependências
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar o restante do código da aplicação
COPY . .

# Construir a aplicação React
RUN pnpm run build

# Expor porta (apenas para fins de desenvolvimento/depuração, não será usada pelo Nginx)
EXPOSE 3000

# Comando para iniciar a aplicação em modo desenvolvimento (pode ser sobrescrito pelo docker-compose)
CMD ["pnpm", "run", "dev", "--host"]

