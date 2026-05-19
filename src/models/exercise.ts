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

export type DefaultExerciseCategory = (typeof exerciseCategories)[number];
export type ExerciseCategory = string;

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

export const exerciseCategoryLabels: Record<DefaultExerciseCategory, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
  mobility: "Mobility",
  full_body: "Full body",
  other: "Other",
};

export function isDefaultExerciseCategory(category: string): category is DefaultExerciseCategory {
  return exerciseCategories.includes(category as DefaultExerciseCategory);
}

export function normalizeExerciseCategories(categories?: readonly string[]): string[] {
  const normalizedCategories = (categories ?? [])
    .map((category) => category.trim())
    .filter(Boolean)
    .filter((category, index, allCategories) => {
      const normalizedCategory = category.toLowerCase();
      return allCategories.findIndex((item) => item.toLowerCase() === normalizedCategory) === index;
    });

  return normalizedCategories.length > 0 ? normalizedCategories : [...exerciseCategories];
}
