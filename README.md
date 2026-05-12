# Workout

Workout is a local-first web app for building, running, and tracking workout sessions.

The app combines:

- Exercise library management
- Drag-and-drop workout builder
- Mixed workout steps: timed exercises and repetition-based exercises
- Voice announcements
- Interval timer with breaks
- Session tracking and workout history
- English/French interface and voice templates
- SQLite-backed persistence
- Docker deployment on port `8060`

## Target Platform

Web app, designed to run locally or on a private web server.

## Tech Stack

Recommended implementation:

- React
- TypeScript
- Vite
- Tailwind CSS
- SQLite for local persistence
- dnd-kit for drag-and-drop
- Web Speech API for voice announcements
- Docker + Node for production serving

## Required Runtime

The app must be served on:

```bash
http://localhost:8060
```

## Core Concepts

### Exercise

An exercise is a reusable item in the exercise library.

```ts
type Exercise = {
  id: string;
  name: string;
  category: "push" | "pull" | "legs" | "core" | "cardio" | "mobility" | "full_body" | "other";
  defaultMode: "time" | "reps";
  defaultDurationSeconds?: number;
  defaultReps?: number;
  notes?: string;
};
```

### Workout Step

A workout is made of ordered steps.

A step can be time-based or reps-based.

```ts
type WorkoutStep =
  | {
      id: string;
      type: "time";
      exerciseId: string;
      exerciseName: string;
      durationSeconds: number;
      breakSeconds: number;
      weight?: number;
    }
  | {
      id: string;
      type: "reps";
      exerciseId: string;
      exerciseName: string;
      reps: number;
      breakSeconds: number;
      weight?: number;
    };
```

### Workout Plan

```ts
type WorkoutPlan = {
  id: string;
  name: string;
  rounds: number;
  steps: WorkoutStep[];
  createdAt: string;
  updatedAt: string;
};
```

### Workout Session

```ts
type WorkoutSession = {
  id: string;
  workoutPlanId?: string;
  workoutName: string;
  startedAt: string;
  completedAt?: string;
  completed: boolean;
  roundsCompleted: number;
  steps: WorkoutSessionStep[];
};
```

## Timer Behavior

### Time-Based Step

Example:

```text
Bench Press - 45 seconds
Break - 15 seconds
```

Behavior:

1. Announce exercise.
2. Start countdown automatically.
3. When timer reaches zero, announce break.
4. Start break countdown automatically.
5. Move to next step.

### Reps-Based Step

Example:

```text
Bench Press - 20 reps
Break - 15 seconds
```

Behavior:

1. Announce exercise and target reps.
2. Wait for user to click `Done`.
3. Announce break.
4. Start break countdown automatically.
5. Move to next step.

## Voice Announcements

Use the browser Web Speech API for MVP.

The app supports English and French UI labels and matching voice announcement templates.

Examples:

```text
Next, Bench Press for 45 seconds.
Now let's do Burpees, 20 reps.
Break time, 15 seconds.
Workout complete. Great job.
```

Voice must be optional and configurable. The selected browser voice, language, rate, pitch, and volume are saved in app settings.

## Storage

The production app stores exercises, workout plans, completed sessions, and settings in SQLite through the local Node API.

The database file lives in the Docker volume mounted at:

```text
/srv/webdata/workout/workout.sqlite
```

Inside the container this path is mounted as `/data/workout.sqlite`.

Existing browser localStorage data is migrated into SQLite on first API-backed load.

## Demo data

Generate sample workout plans and completed history in the configured SQLite database:

```bash
npm run seed:demo
```

The command replaces only previous demo rows with `demo-` IDs and keeps real app data intact.

## Login

Authentication is enabled when `WORKOUT_PASSWORD_HASH` is set in `.env` or the server environment.

Generate an Argon2 hash:

```bash
python -c "from argon2 import PasswordHasher; import getpass; print(PasswordHasher().hash(getpass.getpass('Password: ')))"
```

Then create `.env`:

```text
WORKOUT_PASSWORD_HASH='$argon2id$...'
WORKOUT_AUTH_SECRET=replace-with-a-long-random-string
```

`WORKOUT_AUTH_SECRET` signs the HTTP-only session cookie. If it is omitted, the password hash is used as the signing secret.

## Docker

The app must include:

- `Dockerfile`
- `docker-compose.yml`
- Node production server
- SQLite bind mount at `/srv/webdata/workout`
- Port mapping to `8060`

Expected command:

```bash
docker compose up -d --build
```

Expected URL:

```bash
http://localhost:8060
```

## MVP Features

- Exercise library
- Add/edit/delete exercises
- Preloaded common exercises
- Workout builder
- Drag-and-drop reordering
- Time/reps step support
- Per-step break duration
- Optional weight field
- Rounds support
- Active workout timer
- Voice announcements
- Pause/resume/stop
- Save completed session
- History page

## Future Features

- User accounts
- Cloud sync
- Better AI trainer voices
- Workout templates
- Progress charts
- Import/export JSON
- PWA/offline support
