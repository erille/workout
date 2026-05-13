export const exerciseCategories = [
  "push",
  "pull",
  "legs",
  "core",
  "cardio",
  "mobility",
  "full_body",
  "other",
] as const;

export type ExerciseCategory = (typeof exerciseCategories)[number];

export type ExerciseMode = "time" | "reps" | "distance";

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  defaultMode: ExerciseMode;
  defaultDurationSeconds?: number;
  defaultReps?: number;
  defaultDistanceMeters?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export const exerciseCategoryLabels: Record<ExerciseCategory, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
  mobility: "Mobility",
  full_body: "Full body",
  other: "Other",
};
