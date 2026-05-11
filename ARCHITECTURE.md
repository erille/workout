# Architecture

## Overview

Workout is a local-first React web app.

The frontend handles:

- Exercise management
- Workout building
- Timer state machine
- Voice announcements
- Local persistence
- Session history

There is no backend in the MVP.

## Recommended Folder Structure

```text
Workout/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── exercises/
│   │   ├── workout-builder/
│   │   ├── timer/
│   │   └── history/
│   ├── data/
│   │   ├── defaultExercises.ts
│   │   └── storage.ts
│   ├── hooks/
│   │   ├── useExercises.ts
│   │   ├── useWorkoutPlans.ts
│   │   ├── useWorkoutTimer.ts
│   │   └── useSpeech.ts
│   ├── models/
│   │   ├── exercise.ts
│   │   ├── workout.ts
│   │   ├── session.ts
│   │   └── settings.ts
│   ├── services/
│   │   ├── workoutEngine.ts
│   │   ├── speechService.ts
│   │   └── sessionService.ts
│   ├── styles/
│   │   └── index.css
│   └── main.tsx
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Main Modules

### Exercise Library

Responsible for:

- Loading default exercises
- Creating exercises
- Updating exercises
- Deleting exercises

### Workout Builder

Responsible for:

- Creating workout plans
- Adding workout steps
- Reordering steps
- Editing step configuration
- Saving workout plans

### Workout Timer Engine

The timer should be implemented as a state machine.

Recommended states:

```ts
type TimerPhase =
  | "idle"
  | "exercise_time"
  | "exercise_reps"
  | "break"
  | "paused"
  | "completed"
  | "stopped";
```

Recommended runtime state:

```ts
type WorkoutRuntimeState = {
  phase: TimerPhase;
  currentRound: number;
  totalRounds: number;
  currentStepIndex: number;
  remainingSeconds: number;
  isPaused: boolean;
};
```

## Timer State Rules

### Starting Workout

1. Load first step.
2. Announce first exercise.
3. If step is time-based, start countdown.
4. If step is reps-based, wait for `Done`.

### Time Step Completion

1. When countdown reaches zero, switch to break.
2. Announce break.
3. Start break countdown.

### Reps Step Completion

1. Wait until user clicks `Done`.
2. Switch to break.
3. Announce break.
4. Start break countdown.

### Break Completion

1. Move to next step.
2. If no next step, move to next round.
3. If no next round, complete workout.
4. Announce next exercise or completion.

## Speech Service

Use Web Speech API.

The speech service should expose:

```ts
speak(text: string): void;
cancel(): void;
isSupported(): boolean;
```

Do not make components call `window.speechSynthesis` directly.

## Storage Service

Use a single abstraction for persistence.

Suggested API:

```ts
getExercises(): Promise<Exercise[]>;
saveExercises(exercises: Exercise[]): Promise<void>;

getWorkoutPlans(): Promise<WorkoutPlan[]>;
saveWorkoutPlans(plans: WorkoutPlan[]): Promise<void>;

getSessions(): Promise<WorkoutSession[]>;
saveSessions(sessions: WorkoutSession[]): Promise<void>;

getSettings(): Promise<AppSettings>;
saveSettings(settings: AppSettings): Promise<void>;
```

This allows localStorage first and IndexedDB later.

## Deployment

Production build:

```bash
npm run build
```

Docker should serve the built static files through Nginx.

Port inside container:

```text
80
```

Host port:

```text
8060
```

Docker Compose mapping:

```yaml
ports:
  - "8060:80"
```
