# Estágio 1: Build da aplicação React
FROM node:18-alpine AS build

# Define o diretório de trabalho
WORKDIR /app

# Copia o package.json e package-lock.json para o contêiner
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto dos arquivos da aplicação
COPY . .

# Constrói a aplicação para produção
RUN npm run build

# Estágio 2: Servidor web Nginx
FROM nginx:1.25-alpine

# Copia os arquivos de build do estágio anterior para o diretório do Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Expõe a porta 80
EXPOSE 80

# Comando para iniciar o servidor Nginx
CMD ["nginx", "-g", "daemon off;"]
