FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY web/package.json web/package-lock.json* ./web/
COPY shared/package.json shared/package-lock.json* ./shared/

RUN npm install

COPY web ./web
COPY shared ./shared

WORKDIR /app/web
RUN npm run build

EXPOSE 5175

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5175"]
