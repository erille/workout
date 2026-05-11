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

export type WorkoutPlan = {
  id: string;
  name: string;
  rounds: number;
  steps: WorkoutStep[];
  createdAt: string;
  updatedAt: string;
};
