FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/
COPY shared/package.json shared/package-lock.json* ./shared/

RUN npm install

COPY server ./server
COPY shared ./shared

WORKDIR /app/server
RUN npm run prisma:generate\n+RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
