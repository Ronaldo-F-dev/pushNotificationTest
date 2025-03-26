FROM node:18

WORKDIR /app

COPY package*.json ./
COPY server.js ./
COPY serviceAccountKey.json ./
RUN npm install
CMD ["node", "server.js"]