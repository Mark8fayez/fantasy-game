FROM node:20-alpine
WORKDIR /app
COPY fantasy-game/package*.json ./
RUN npm install --omit=dev
COPY fantasy-game/ .
EXPOSE 3000
CMD ["npm", "start"]
