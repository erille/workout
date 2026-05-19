import type { Language } from "../i18n/translations";

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
export type ExerciseCategoryLabels = Partial<Record<Language, string>>;
export type ExerciseCategoryDefinition = {
  id: ExerciseCategory;
  labels: ExerciseCategoryLabels;
};

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

export const defaultExerciseCategoryDefinitions: ExerciseCategoryDefinition[] =
  exerciseCategories.map((category) => ({
    id: category,
    labels: {},
  }));

export function normalizeCategoryInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCategoryDefinition(
  category: unknown,
  fallbackLanguage: Language,
): ExerciseCategoryDefinition | null {
  if (typeof category === "string") {
    const id = normalizeCategoryInput(category);

    if (!id) {
      return null;
    }

    return {
      id,
      labels: isDefaultExerciseCategory(id) ? {} : { [fallbackLanguage]: id },
    };
  }

  if (!category || typeof category !== "object" || Array.isArray(category)) {
    return null;
  }

  const rawCategory = category as { id?: unknown; labels?: unknown };
  const id = typeof rawCategory.id === "string" ? normalizeCategoryInput(rawCategory.id) : "";

  if (!id) {
    return null;
  }

  const rawLabels =
    rawCategory.labels && typeof rawCategory.labels === "object" && !Array.isArray(rawCategory.labels)
      ? (rawCategory.labels as Partial<Record<Language, unknown>>)
      : {};
  const labels: ExerciseCategoryLabels = {};

  (["en", "fr"] as const).forEach((language) => {
    const label =
      typeof rawLabels[language] === "string"
        ? normalizeCategoryInput(rawLabels[language] ?? "")
        : "";

    if (label) {
      labels[language] = label;
    }
  });

  return { id, labels };
}

export function normalizeExerciseCategoryDefinitions(
  categories?: readonly unknown[],
  fallbackLanguage: Language = "fr",
): ExerciseCategoryDefinition[] {
  const normalizedCategories = (categories ?? [])
    .map((category) => normalizeCategoryDefinition(category, fallbackLanguage))
    .filter((category): category is ExerciseCategoryDefinition => Boolean(category))
    .filter((category, index, allCategories) => {
      const normalizedCategory = category.id.toLowerCase();
      return (
        allCategories.findIndex((item) => item.id.toLowerCase() === normalizedCategory) === index
      );
    });

  return normalizedCategories.length > 0
    ? normalizedCategories
    : defaultExerciseCategoryDefinitions.map((category) => ({
        ...category,
        labels: { ...category.labels },
      }));
}

export function createExerciseCategoryDefinition(
  label: string,
  language: Language,
): ExerciseCategoryDefinition {
  const id = normalizeCategoryInput(label);

  return {
    id,
    labels: {
      [language]: id,
    },
  };
}
