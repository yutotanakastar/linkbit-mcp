FROM node:22-alpine
WORKDIR /app
COPY package.json cli.js server.json ./
COPY src ./src
ENV NODE_ENV=production
ENV APP_URL=https://linkbit.live
# API_KEY must be provided at runtime (Glama / client env).
USER node
CMD ["node", "src/index.js"]
