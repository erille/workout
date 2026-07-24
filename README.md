# Workout

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=06101f)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=fff)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=fff)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=fff)](https://sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=fff)](https://www.docker.com/)
[![Last commit](https://img.shields.io/github/last-commit/erille/workout?logo=github)](https://github.com/erille/workout)

Workout is a local-first web app for building, running, and tracking workout sessions. It works as a public guest tool in the browser, and can also unlock isolated SQLite-backed user spaces with a login and password.

## Features

- Exercise library with add, edit, delete, categories, notes, and defaults.
- Drag-and-drop workout builder.
- Timed, repetition-based, and distance-based workout steps.
- Optional per-step weight tracking.
- Rounds, breaks, 5-second get-ready countdown, active timer, pause, resume, stop, partial save, and completion flow.
- Quick interval timer with saved last-used work/rest/round settings.
- Completed workout history with manual entry, workout/exercise filtering, and partial session tracking.
- Statistics page with weekly/monthly/yearly workout counts and a first lifting-progress view for weighted reps.
- Optional server-mode virtual coach chat backed by OpenAI or OpenRouter.
- English and French interface.
- Audio modes for local Piper TTS, browser voice, beeps, and silent workouts.
- Separate app language and spoken announcement language.
- Character page with built-in avatars or an uploaded photo.
- Guest mode using browser localStorage.
- Local mode JSON export/import for moving browser data between devices.
- Private mode using SQLite through the Node API.
- Two-user login with Argon2 hash support and isolated private data.
- PWA install support with basic static app-shell caching.
- Docker deployment on port `8060`.

## Data Modes

Workout has two separated storage modes:

| Mode | Who uses it | Storage | Privacy behavior |
| --- | --- | --- | --- |
| Local mode | Visitors before login | Browser localStorage under `workout.guest.*` | Never reads private API data |
| Private mode | Logged-in configured user | SQLite through `/api` | Protected by login/password session cookie and isolated by user |
| Server mode | No password configured | SQLite through `/api` | API is open on the deployed app |

Guest/local data is not automatically imported into the private database. This keeps visitor experiments separate from each configured user's database records.

Local mode includes JSON export/import from the top navigation so browser-only data can be backed up or moved to another browser.

The virtual coach is intentionally server-mode only. It is hidden in guest/local mode because coach requests need a server-side API key and may create SQLite-backed Builds, exercises, and categories.

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
- Piper TTS with cached generated audio
- Web app manifest and service worker
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
| `npm test` | Run the user migration and data-isolation integration test |
| `npm start` | Serve `dist` and the API with Node |
| `npm run preview` | Alias for the production Node server |
| `npm run api` | Run the Node API/static server |
| `npm run seed:demo` | Add demo plans and history to the configured SQLite database |

## Authentication

Login is enabled when at least the owner password hash is configured. Workout supports one owner
and one partner account, both declared through environment variables. Logins are matched without
case sensitivity.

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
WORKOUT_OWNER_LOGIN=ketah
WORKOUT_OWNER_PASSWORD_HASH='$argon2id$...'
WORKOUT_PARTNER_LOGIN=Jee
WORKOUT_PARTNER_PASSWORD_HASH='$argon2id$...'
WORKOUT_AUTH_SECRET=replace-with-a-long-random-string
```

Quote password hashes because Argon2 hashes contain `$`. Existing deployments may keep
`WORKOUT_PASSWORD_HASH`: it remains a fallback for `WORKOUT_OWNER_PASSWORD_HASH`.

`WORKOUT_AUTH_SECRET` signs the HTTP-only session cookie. If it is omitted, a configured password
hash is used as the signing secret.

On the first startup after upgrading an existing database, Workout creates a timestamped
`workout.pre-users.*.sqlite` backup next to the active database. Existing exercises, Builds,
history, settings, profile, and Coach messages are assigned to the owner account. The partner
account starts with the default exercises and an empty profile and history.

Generate a random cookie secret with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Virtual Coach

The Coach page is available only when the app is using server/private mode. It lets the server-side coach read workout data and create Builds, exercises, and categories directly after validating the generated data. Chat history is saved in the SQLite database.

Configure one provider in `.env` or the server environment. OpenAI is the default:

```text
COACH_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
COACH_REQUEST_TIMEOUT_MS=45000
COACH_MAX_TOKENS=1200
```

OpenRouter can be used to try alternate models:

```text
COACH_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_SITE_URL=https://your-workout-domain.example
OPENROUTER_APP_NAME=Workout
```

With OpenRouter, Coach responses are streamed progressively in the interface. Workout keeps the
provider connection on the server, reconstructs any streamed tool calls before executing them,
excludes provider reasoning from the visible response, and saves only the completed
user/assistant messages to SQLite. The Coach always answers in French. The stream response also
disables common reverse-proxy buffering through its response headers.

The selected provider/model can be changed later because coach instructions, app data, and chat history are stored by Workout, not by the model provider.

`COACH_REQUEST_TIMEOUT_MS` defaults to 45 seconds so a slow provider fails before a typical HTTPS reverse proxy returns a generic 504. Free OpenRouter models can still be unavailable or slow during busy periods; if this happens repeatedly, choose a faster model or raise both this timeout and your reverse proxy timeout.

When using Docker Compose, these `.env` values are passed into the container by `docker-compose.yml`. Restart/recreate the container after changing them:

```bash
docker compose up -d --build
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

The first Docker build downloads Piper and the bundled English/French voice models, so that build can take longer than later rebuilds.

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
| `POST /api/auth/login` | Public | Verify login/password and set a user-scoped session cookie |
| `POST /api/auth/logout` | Public | Clear session cookie |
| `GET /api/data` | Private when login is enabled | Load all app data |
| `POST /api/import` | Private when login is enabled | Replace all app data |
| `GET /api/tts/status` | Private when login is enabled | Check local Piper TTS availability |
| `POST /api/tts` | Private when login is enabled | Generate or reuse cached Piper speech |
| `GET /api/tts/audio/:file` | Private when login is enabled | Play cached generated speech |
| `GET /api/coach/status` | Private when login is enabled | Check virtual coach provider configuration |
| `GET /api/coach/messages` | Private when login is enabled | Load saved coach chat history |
| `POST /api/coach/chat` | Private when login is enabled | Send a coach message and allow validated app tools |
| `POST /api/coach/chat/stream` | Private when login is enabled | Stream an OpenRouter coach response and allow validated app tools |
| `POST /api/coach/clear` | Private when login is enabled | Clear coach chat history |
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

- Deeper lifting analytics and body-weight-aware calculations.
- Better generated audio cache management.
- More workout templates.
- Optional richer voice engine.
