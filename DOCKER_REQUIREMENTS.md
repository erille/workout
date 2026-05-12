# Docker Requirements

## Goal

The app must run as a Dockerized web app on port `8060`.

## Runtime

The production container uses Node `22-alpine`.

The Node server:

- Serves the built React files from `dist`
- Serves the local API under `/api`
- Stores app data in SQLite

## Required Files

```text
Dockerfile
docker-compose.yml
.dockerignore
```

## Data Persistence

SQLite is stored at:

```text
/data/workout.sqlite
```

`docker-compose.yml` must mount `/data` as a named volume so workouts and history survive container rebuilds.

## Build Command

```bash
docker compose up -d --build
```

## Verification

```bash
docker ps
curl -I http://localhost:8060
curl http://localhost:8060/api/health
```

Expected result:

```text
HTTP/1.1 200 OK
{"ok":true}
```
