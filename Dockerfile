# Estágio 1: Build da aplicação React/Vite
FROM node:18-alpine AS build

WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./
RUN npm install

# Copia o restante do código e faz o build de produção
COPY . .
RUN npm run build

# Estágio 2: Servidor Web Nginx
FROM nginx:alpine

# Remove as configurações originais do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia a pasta compilada (dist) do estágio 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copia o arquivo de configuração para suportar rotas SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80
EXPOSE 80

# Inicia o servidor
CMD ["nginx", "-g", "daemon off;"]
