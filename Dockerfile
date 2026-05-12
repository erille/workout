FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8060
ENV WORKOUT_DB_PATH=/data/workout.sqlite
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY server ./server
COPY package*.json ./
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8060
CMD ["node", "server/index.js"]
