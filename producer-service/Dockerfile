# Usar uma imagem base do Node.js
FROM node:18-alpine

# Definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar os arquivos de dependências
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar o código da aplicação
COPY . .

# Expor a porta que o serviço vai usar
EXPOSE 3001

# Comando para iniciar o serviço
CMD [ "npm", "start" ]
