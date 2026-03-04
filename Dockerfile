FROM node:20-alpine

# Install required dependencies for baileys
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

COPY package*.json ./

# Install dependencies (including dev for build tools)
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]