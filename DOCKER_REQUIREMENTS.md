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

SQLite is stored inside the container at:

```text
/data/workout.sqlite
```

`docker-compose.yml` must bind-mount `/data` to the host path:

```text
/srv/webdata/workout
```

On the server, the database should therefore live at:

```text
/srv/webdata/workout/workout.sqlite
```

Create the host folder before starting the container if Docker cannot create it automatically:

```bash
sudo mkdir -p /srv/webdata/workout
```

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
