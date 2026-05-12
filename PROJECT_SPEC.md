# Workout App Project Specification

## Goal

Build a Dockerized web application for creating, running, and tracking workout sessions.

The app should support both simple interval training and advanced mixed workouts with timed and repetition-based exercises.

## Application Pages

### 1. Exercise Library

Purpose:

Manage the reusable exercise database.

Required features:

- Display list of exercises
- Search/filter exercises
- Add exercise
- Edit exercise
- Delete exercise
- Show exercise category
- Show default mode: time or reps

Default exercise examples:

- Push-up
- Bench Press
- Squat
- Deadlift
- Pull-up
- Burpees
- Dead Bug
- Plank
- Lunges
- Shoulder Press
- Row
- Sit-up
- Mountain Climbers
- Jumping Jacks
- Kettlebell Swing
- Glute Bridge
- Romanian Deadlift
- Bicep Curl
- Tricep Extension
- Side Plank

### 2. Workout Builder

Purpose:

Create an ordered workout plan from the exercise library.

Required features:

- Select exercises from library
- Add exercise to workout plan
- Reorder workout steps by drag and drop
- Remove step from workout plan
- Configure each step independently:
  - Type: time or reps
  - Duration seconds if time-based
  - Reps if reps-based
  - Break seconds
  - Optional weight
- Configure workout rounds
- Save workout plan
- Start workout

Important behavior:

- Simple setup should allow same duration/break for all selected exercises.
- Advanced setup should allow each step to have its own type and values.

### 3. Active Workout Timer

Purpose:

Run the selected workout plan.

Required features:

- Display current round
- Display total rounds
- Display current exercise name
- Display step mode: time or reps
- Display countdown for time-based exercises
- Display target reps for reps-based exercises
- Show `Done` button for reps-based exercises
- Show break countdown
- Show next exercise preview
- Pause workout
- Resume workout
- Stop workout
- Complete workout
- Save session history

Timer rules:

#### Time step

1. Announce exercise.
2. Start timer automatically.
3. At zero, announce break.
4. Start break automatically.
5. After break, continue to next step.

#### Reps step

1. Announce exercise.
2. Wait for user to click `Done`.
3. Announce break.
4. Start break automatically.
5. After break, continue to next step.

### 4. Session Summary

Purpose:

Review workout result before saving.

Required features:

- Show workout name
- Show start time
- Show completed time
- Show exercises completed
- Show duration/reps/weight per exercise
- Show rounds completed
- Save session

### 5. History

Purpose:

Track previous workouts.

Required features:

- List completed sessions
- Show date
- Show workout name
- Show exercises
- Show time/reps/weight
- Show rounds completed
- Delete session
- Optional filter by exercise name

## Storage

Use SQLite through the local Node API for persisted app data.

The browser storage layer may keep a local fallback and should migrate existing localStorage data into SQLite on first API-backed load.

Required stored entities:

- Exercises
- Workout plans
- Workout sessions
- App settings

## Voice Announcements

Use Web Speech API for MVP.

Required settings:

- Enable/disable voice
- Select app language: English or French
- Select browser voice
- Voice rate
- Voice pitch
- Voice volume

Announcement examples:

### Time exercise

```text
Next, Dead Bug for 45 seconds.
```

### Reps exercise

```text
Now let's do Bench Press, 20 reps.
```

### Break

```text
Break time, 15 seconds.
```

### Complete

```text
Workout complete. Great job.
```

Use sentence templates. Do not integrate external AI/TTS in MVP.

## UI Requirements

Style:

- Clean
- Responsive
- Mobile-friendly
- Dark mode preferred
- Large timer display
- Large start/pause/done buttons
- Easy to use during workout

Recommended layout:

- Sidebar or top navigation
- Pages:
  - Exercises
  - Builder
  - Timer
  - History
  - Settings

## Docker Requirements

The project must run with:

```bash
docker compose up -d --build
```

The app must be available at:

```bash
http://localhost:8060
```

Required files:

- Dockerfile
- docker-compose.yml
- .dockerignore

## Quality Requirements

- TypeScript strict mode
- Reusable components
- Clean data models
- No hardcoded state inside components when persistence is needed
- Defensive input validation
- No unsafe browser APIs
- No backend required for MVP
- No authentication required for MVP

## Acceptance Criteria

The app is complete when:

1. Docker build works.
2. App runs on port `8060`.
3. User can manage exercises.
4. User can build a workout.
5. User can reorder workout steps.
6. User can mix time-based and reps-based steps.
7. Timer correctly handles automatic and manual transitions.
8. Voice announcements work.
9. Completed sessions are saved.
10. Workout history can be viewed.
