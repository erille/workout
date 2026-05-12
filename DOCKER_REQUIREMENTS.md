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

## Authentication

Docker Compose reads `WORKOUT_PASSWORD_HASH` and `WORKOUT_AUTH_SECRET` from the shell or project `.env`.

Generate the password hash with:

```bash
python -c "from argon2 import PasswordHasher; import getpass; print(PasswordHasher().hash(getpass.getpass('Password: ')))"
```

Example `.env`:

```text
WORKOUT_PASSWORD_HASH='$argon2id$...'
WORKOUT_AUTH_SECRET=replace-with-a-long-random-string
```

## Demo Data

After rebuilding the image, seed sample workout plans and history into `/srv/webdata/workout/workout.sqlite`:

```bash
docker compose run --rm workout npm run seed:demo
```

The command replaces only previous demo rows with `demo-` IDs and keeps real app data intact.

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
