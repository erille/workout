# Codex Implementation Tasks

## Objective

Build the first working version of the Workout web app.

The app must be Dockerized and run on port `8060`.

## Step 1: Initialize App

Create a React + TypeScript + Vite app.

Install:

- React
- TypeScript
- Vite
- Tailwind CSS
- dnd-kit
- lucide-react

Recommended packages:

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react
npm install -D tailwindcss postcss autoprefixer
```

## Step 2: Create Core Models

Create:

```text
src/models/exercise.ts
src/models/workout.ts
src/models/session.ts
src/models/settings.ts
```

Use the definitions from `DATA_MODEL.md`.

## Step 3: Add Default Exercises

Create:

```text
src/data/defaultExercises.ts
```

Include at least 20 common exercises.

## Step 4: Add Storage Service

Create:

```text
src/data/storage.ts
```

Use localStorage for the first version.

Storage keys:

```ts
workout.exercises
workout.plans
workout.sessions
workout.settings
```

Wrap all storage functions in async functions so IndexedDB can replace it later.

## Step 5: Add Speech Service

Create:

```text
src/services/speechService.ts
```

Implement:

```ts
speak()
cancelSpeech()
isSpeechSupported()
```

Use Web Speech API.

## Step 6: Add Timer Engine

Create:

```text
src/services/workoutEngine.ts
src/hooks/useWorkoutTimer.ts
```

Implement mixed timer behavior:

- Time steps auto-complete.
- Reps steps wait for Done.
- Break starts after each step.
- Break can be skipped if 0 seconds.
- Workout supports rounds.
- Completion saves session data.

## Step 7: Build Pages

Create pages/components:

```text
src/components/exercises/ExerciseLibrary.tsx
src/components/workout-builder/WorkoutBuilder.tsx
src/components/timer/ActiveWorkout.tsx
src/components/history/WorkoutHistory.tsx
src/components/settings/Settings.tsx
```

## Step 8: Navigation

Create simple navigation:

```text
Exercises
Builder
Timer
History
Settings
```

No React Router required for MVP unless useful.

## Step 9: Drag and Drop

Use dnd-kit in Workout Builder.

Requirement:

- User can reorder workout steps.
- Reordered steps must persist in saved workout plan.

## Step 10: Docker

Create:

```text
Dockerfile
docker-compose.yml
nginx.conf
.dockerignore
```

App must run on:

```text
http://localhost:8060
```

## Step 11: Validate

Run:

```bash
npm run build
docker compose up -d --build
curl -I http://localhost:8060
```

Fix all TypeScript and build errors.

## Step 12: Final Deliverable

The final repo must include:

- Complete source code
- Docker files
- README
- Working build
- Working local persistence
- Working voice announcements
- Working timer
- Working history
