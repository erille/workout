# Workout

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=06101f)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=fff)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=fff)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=fff)](https://sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=fff)](https://www.docker.com/)
[![Last commit](https://img.shields.io/github/last-commit/erille/workout?logo=github)](https://github.com/erille/workout)

Workout is a local-first web app for building, running, and tracking workout sessions. It works as a public guest tool in the browser, and can also unlock a private SQLite-backed mode with a simple password.

## Features

- Exercise library with add, edit, delete, categories, notes, and defaults.
- Drag-and-drop workout builder.
- Timed and repetition-based workout steps.
- Optional per-step weight tracking.
- Rounds, breaks, active timer, pause, resume, stop, and completion flow.
- Completed workout history with workout/exercise filtering.
- English and French interface.
- Audio modes for local Piper TTS, browser voice, beeps, and silent workouts.
- Guest mode using browser localStorage.
- Private mode using SQLite through the Node API.
- Password login with Argon2 hash support.
- Docker deployment on port `8060`.

## Data Modes

Workout has two separated storage modes:

| Mode | Who uses it | Storage | Privacy behavior |
| --- | --- | --- | --- |
| Local mode | Visitors before login | Browser localStorage under `workout.guest.*` | Never reads private API data |
| Private mode | Logged-in owner | SQLite through `/api` | Protected by password session cookie |
| Server mode | No password configured | SQLite through `/api` | API is open on the deployed app |

Guest/local data is not automatically imported into the private database. This keeps visitor experiments separate from the owner database.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- dnd-kit
- Lucide React icons
- Node 22
- SQLite via `node:sqlite`
- Argon2 password verification
- Docker Compose

## Quick Start

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build the production frontend:

```bash
npm run build
```

Run the production Node server:

```bash
npm start
```

Default local URL:

```text
http://localhost:8060
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the production frontend |
| `npm start` | Serve `dist` and the API with Node |
| `npm run preview` | Alias for the production Node server |
| `npm run api` | Run the Node API/static server |
| `npm run seed:demo` | Add demo plans and history to the configured SQLite database |

## Authentication

Login is enabled only when `WORKOUT_PASSWORD_HASH` is set in `.env` or the server environment.

Generate an Argon2 hash with Python:

```bash
python -c "from argon2 import PasswordHasher; import getpass; print(PasswordHasher().hash(getpass.getpass('Password: ')))"
```

Or generate one with the project Node dependency:

```bash
node --input-type=module -e "import argon2 from 'argon2'; import readline from 'node:readline/promises'; import { stdin, stdout } from 'node:process'; const rl = readline.createInterface({ input: stdin, output: stdout }); const password = await rl.question('Password: '); rl.close(); console.log(await argon2.hash(password));"
```

Create `.env`:

```text
WORKOUT_PASSWORD_HASH='$argon2id$...'
WORKOUT_AUTH_SECRET=replace-with-a-long-random-string
```

Quote `WORKOUT_PASSWORD_HASH` because Argon2 hashes contain `$`.

`WORKOUT_AUTH_SECRET` signs the HTTP-only session cookie. If it is omitted, the password hash is used as the signing secret.

Generate a random cookie secret with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Security Notes

- Real secrets must stay in `.env` or the server environment.
- `.env`, `.env.local`, `data/`, `dist/`, and test logs are ignored by Git.
- `.env.example` contains placeholders only.
- The repository does not contain a real password hash, plaintext password, token, API key, or private key.
- Private API data is never mirrored into guest localStorage.
- The login cookie is `HttpOnly`, `SameSite=Lax`, and can be marked secure with `WORKOUT_COOKIE_SECURE=true`.
- If the app is served over HTTPS, set `WORKOUT_COOKIE_SECURE=true`.

## Docker Deployment

The production container:

- Builds the React app into `dist`.
- Serves static files and `/api` from Node.
- Stores SQLite data in `/data/workout.sqlite`.
- Generates and caches Piper TTS audio in `/data/tts-cache`.
- Exposes port `8060`.

Start or rebuild:

```bash
docker compose up -d --build
```

The compose file mounts:

```text
/srv/webdata/workout:/data
```

So the host database lives at:

```text
/srv/webdata/workout/workout.sqlite
```

Cached generated voice files live at:

```text
/srv/webdata/workout/tts-cache
```

Create the host directory if needed:

```bash
sudo mkdir -p /srv/webdata/workout
```

## Demo Data

Seed sample workout plans and completed history:

```bash
npm run seed:demo
```

Inside Docker:

```bash
docker compose run --rm workout npm run seed:demo
```

The seed command creates 3 demo plans and 11 completed sessions. It replaces only rows with `demo-` IDs and keeps real data intact.

## API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Health check |
| `GET /api/auth/status` | Public | Check auth/session status |
| `POST /api/auth/login` | Public | Verify password and set session cookie |
| `POST /api/auth/logout` | Public | Clear session cookie |
| `GET /api/data` | Private when login is enabled | Load all app data |
| `POST /api/import` | Private when login is enabled | Replace all app data |
| `GET /api/tts/status` | Private when login is enabled | Check local Piper TTS availability |
| `POST /api/tts` | Private when login is enabled | Generate or reuse cached Piper speech |
| `GET /api/tts/audio/:file` | Private when login is enabled | Play cached generated speech |
| `PUT /api/exercises` | Private when login is enabled | Save exercises |
| `PUT /api/plans` | Private when login is enabled | Save workout plans |
| `PUT /api/sessions` | Private when login is enabled | Save history |
| `PUT /api/settings` | Private when login is enabled | Save settings |

## Project Structure

```text
server/
  index.js            Node server, SQLite storage, auth, static serving
  defaultData.js      Default exercises and settings
  seedDemoData.js     Demo data seeding command
src/
  app/                App shell and mode switching
  components/         UI components
  data/               Local/server storage abstraction
  hooks/              React state hooks
  i18n/               English/French translations and exercise names
  models/             Shared TypeScript data models
  services/           Speech, auth, and workout engine services
  styles/             Tailwind entry CSS
```

## Attribution

The in-app About popover shows:

```text
This site uses Workout, a project by Ketah.
```

`Workout` links to <https://github.com/erille/workout>.

## Roadmap

- Progress charts for weight and volume.
- Import/export JSON.
- PWA/offline install support.
- More workout templates.
- Optional richer voice engine.
