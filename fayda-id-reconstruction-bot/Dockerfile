FROM node:20-alpine

# Install node-canvas system dependencies
RUN apk add --no-cache \
    cairo-dev pango-dev libjpeg-turbo-dev giflib-dev \
    librsvg-dev pixman-dev python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN npm prune --production

CMD ["node", "dist/main.js"]
