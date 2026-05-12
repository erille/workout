import type { Language } from "./translations";

type ExerciseNameInput = {
  id?: string;
  exerciseId?: string;
  name?: string;
  exerciseName?: string;
};

const translatedExerciseNames: Record<string, Record<Language, string>> = {
  "exercise-push-up": {
    en: "Push-up",
    fr: "Pompes",
  },
  "exercise-bench-press": {
    en: "Bench Press",
    fr: "Developpe couche",
  },
  "exercise-squat": {
    en: "Squat",
    fr: "Squat",
  },
  "exercise-deadlift": {
    en: "Deadlift",
    fr: "Souleve de terre",
  },
  "exercise-pull-up": {
    en: "Pull-up",
    fr: "Tractions",
  },
  "exercise-burpees": {
    en: "Burpees",
    fr: "Burpees",
  },
  "exercise-dead-bug": {
    en: "Dead Bug",
    fr: "Dead bug",
  },
  "exercise-plank": {
    en: "Plank",
    fr: "Gainage",
  },
  "exercise-lunges": {
    en: "Lunges",
    fr: "Fentes",
  },
  "exercise-shoulder-press": {
    en: "Shoulder Press",
    fr: "Developpe epaules",
  },
  "exercise-row": {
    en: "Row",
    fr: "Rowing",
  },
  "exercise-sit-up": {
    en: "Sit-up",
    fr: "Abdos",
  },
  "exercise-mountain-climbers": {
    en: "Mountain Climbers",
    fr: "Mountain climbers",
  },
  "exercise-jumping-jacks": {
    en: "Jumping Jacks",
    fr: "Jumping jacks",
  },
  "exercise-kettlebell-swing": {
    en: "Kettlebell Swing",
    fr: "Swing kettlebell",
  },
  "exercise-glute-bridge": {
    en: "Glute Bridge",
    fr: "Pont fessier",
  },
  "exercise-romanian-deadlift": {
    en: "Romanian Deadlift",
    fr: "Souleve de terre roumain",
  },
  "exercise-bicep-curl": {
    en: "Bicep Curl",
    fr: "Curl biceps",
  },
  "exercise-tricep-extension": {
    en: "Tricep Extension",
    fr: "Extension triceps",
  },
  "exercise-side-plank": {
    en: "Side Plank",
    fr: "Gainage lateral",
  },
};

const exerciseNameToId = new Map(
  Object.entries(translatedExerciseNames).map((entry) => [entry[1].en.toLowerCase(), entry[0]]),
);

export function translateExerciseName(input: ExerciseNameInput, language: Language): string {
  const rawName = input.exerciseName ?? input.name ?? "";
  const exerciseId = input.exerciseId ?? input.id ?? exerciseNameToId.get(rawName.toLowerCase());

  if (!exerciseId) {
    return rawName;
  }

  return translatedExerciseNames[exerciseId]?.[language] ?? rawName;
}
