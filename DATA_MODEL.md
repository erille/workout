# Data Model

## Exercise

```ts
export type ExerciseCategory =
  | "push"
  | "pull"
  | "legs"
  | "core"
  | "cardio"
  | "mobility"
  | "full_body"
  | "other";

export type ExerciseMode = "time" | "reps";

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  defaultMode: ExerciseMode;
  defaultDurationSeconds?: number;
  defaultReps?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Workout Step

```ts
export type TimeWorkoutStep = {
  id: string;
  type: "time";
  exerciseId: string;
  exerciseName: string;
  durationSeconds: number;
  breakSeconds: number;
  weight?: number;
};

export type RepsWorkoutStep = {
  id: string;
  type: "reps";
  exerciseId: string;
  exerciseName: string;
  reps: number;
  breakSeconds: number;
  weight?: number;
};

export type WorkoutStep = TimeWorkoutStep | RepsWorkoutStep;
```

## Workout Plan

```ts
export type WorkoutPlan = {
  id: string;
  name: string;
  rounds: number;
  steps: WorkoutStep[];
  createdAt: string;
  updatedAt: string;
};
```

## Workout Session Step

```ts
export type WorkoutSessionStep = {
  id: string;
  exerciseId?: string;
  exerciseName: string;
  type: "time" | "reps";
  durationSeconds?: number;
  reps?: number;
  breakSeconds: number;
  weight?: number;
  round: number;
  completed: boolean;
};
```

## Workout Session

```ts
export type WorkoutSession = {
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

## App Settings

```ts
export type AppSettings = {
  voiceEnabled: boolean;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  theme: "dark" | "light";
};
```

## Default Settings

```ts
export const defaultSettings: AppSettings = {
  voiceEnabled: true,
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  theme: "dark"
};
```

## Validation Rules

### Exercise

- Name is required.
- Name must be unique.
- Category is required.
- Default mode is required.

### Workout Plan

- Name is required.
- Must contain at least one step.
- Rounds must be at least 1.

### Time Step

- Duration must be greater than 0.
- Break duration must be 0 or greater.

### Reps Step

- Reps must be greater than 0.
- Break duration must be 0 or greater.

### Weight

- Weight is optional.
- If provided, weight must be 0 or greater.
