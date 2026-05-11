# Docker Requirements

## Goal

The app must run as a Dockerized web app on port `8060`.

## Required Files

The implementation must include:

```text
Dockerfile
docker-compose.yml
nginx.conf
.dockerignore
```

## Dockerfile Requirements

Use a multi-stage build:

1. Node build stage
2. Nginx serve stage

Expected structure:

```Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## docker-compose.yml Requirements

The app must be exposed on port `8060`.

```yaml
services:
  workout:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: workout
    restart: unless-stopped
    ports:
      - "8060:80"
```

## nginx.conf Requirements

React routes must work on refresh.

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Build Command

```bash
docker compose up -d --build
```

## Verification

```bash
docker ps
curl -I http://localhost:8060
```

Expected result:

```text
HTTP/1.1 200 OK
```
