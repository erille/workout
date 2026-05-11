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
