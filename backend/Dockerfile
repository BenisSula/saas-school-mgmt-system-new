FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json jest.config.ts ./
RUN npm install

COPY src ./src
COPY tests ./tests

EXPOSE 3001

CMD ["npm", "run", "dev"]

