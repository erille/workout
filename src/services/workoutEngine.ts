import type { WorkoutSession, WorkoutSessionStep } from "../models/session";
import type { Language } from "../i18n/translations";
import { translateExerciseName } from "../i18n/exerciseNames";
import type { WorkoutPlan, WorkoutStep } from "../models/workout";
import { createId } from "../utils/id";

const voiceTemplates: Record<
  Language,
  {
    ready: string[];
    time: string[];
    reps: string[];
    distance: string[];
    break: string[];
    complete: string[];
  }
> = {
  en: {
    ready: ["Get ready!"],
    time: [
      "Next, {exercise} for {duration} seconds.",
      "Let's go. {exercise}, {duration} seconds.",
      "Get ready for {exercise}, {duration} seconds.",
    ],
    reps: [
      "Now let's do {exercise}, {reps} reps.",
      "Next, {exercise}, {reps} strong reps.",
      "Get ready for {exercise}, {reps} reps.",
    ],
    distance: [
      "Next, {exercise} for {meters} meters.",
      "Let's go. {exercise}, {meters} meters.",
      "Get ready for {exercise}, {meters} meters.",
    ],
    break: [
      "Break time, {break} seconds.",
      "Recover now, {break} seconds.",
      "Nice work. Take {break} seconds.",
    ],
    complete: [
      "Workout complete. Great job.",
      "Session finished. Well done.",
      "Great work. Workout complete.",
    ],
  },
  fr: {
    ready: ["Prépare-toi !"],
    time: [
      "Prochain exercice, {exercise} pendant {duration} secondes.",
      "On y va. {exercise}, {duration} secondes.",
      "Prépare-toi pour {exercise}, {duration} secondes.",
    ],
    reps: [
      "Maintenant, {exercise}, {reps} répétitions.",
      "Prochain exercice, {exercise}, {reps} répétitions.",
      "Prépare-toi pour {exercise}, {reps} répétitions.",
    ],
    distance: [
      "Prochain exercice, {exercise} sur {meters} mètres.",
      "On y va. {exercise}, {meters} mètres.",
      "Prépare-toi pour {exercise}, {meters} mètres.",
    ],
    break: [
      "Pause, {break} secondes.",
      "Récupère maintenant, {break} secondes.",
      "Bien joué. Prends {break} secondes.",
    ],
    complete: [
      "Entraînement terminé. Bien joué.",
      "Session terminée. Beau travail.",
      "Très bon travail. Entraînement terminé.",
    ],
  },
};

function pickTemplate(templates: string[], seed: number): string {
  return templates[Math.abs(seed) % templates.length] ?? templates[0];
}

export function getStepAnnouncement(step: WorkoutStep, language: Language): string {
  const templates = voiceTemplates[language];
  const exerciseName = translateExerciseName(step, language);

  if (step.type === "time") {
    return pickTemplate(templates.time, step.exerciseName.length + step.durationSeconds)
      .replace("{exercise}", exerciseName)
      .replace("{duration}", String(step.durationSeconds));
  }

  if (step.type === "distance") {
    return pickTemplate(templates.distance, step.exerciseName.length + step.distanceMeters)
      .replace("{exercise}", exerciseName)
      .replace("{meters}", String(step.distanceMeters));
  }

  return pickTemplate(templates.reps, step.exerciseName.length + step.reps)
    .replace("{exercise}", exerciseName)
    .replace("{reps}", String(step.reps));
}

export function getBreakAnnouncement(breakSeconds: number, language: Language): string {
  return pickTemplate(voiceTemplates[language].break, breakSeconds).replace("{break}", String(breakSeconds));
}

export function getCompleteAnnouncement(language: Language): string {
  return pickTemplate(voiceTemplates[language].complete, Date.now());
}

export function getReadyAnnouncement(language: Language): string {
  return pickTemplate(voiceTemplates[language].ready, 0);
}

export function getNextStep(
  plan: WorkoutPlan,
  currentStepIndex: number,
  currentRound: number,
): WorkoutStep | undefined {
  if (currentStepIndex + 1 < plan.steps.length) {
    return plan.steps[currentStepIndex + 1];
  }

  if (currentRound < plan.rounds) {
    return plan.steps[0];
  }

  return undefined;
}

export function createSessionStep(
  step: WorkoutStep,
  round: number,
  weight?: number,
): WorkoutSessionStep {
  return {
    id: createId("session-step"),
    exerciseId: step.exerciseId,
    exerciseName: step.exerciseName,
    type: step.type,
    durationSeconds: step.type === "time" ? step.durationSeconds : undefined,
    reps: step.type === "reps" ? step.reps : undefined,
    distanceMeters: step.type === "distance" ? step.distanceMeters : undefined,
    breakSeconds: step.breakSeconds,
    weight,
    round,
    completed: true,
  };
}

export function createWorkoutSession(
  plan: WorkoutPlan,
  startedAt: string,
  completedAt: string,
  steps: WorkoutSessionStep[],
  options?: {
    completed?: boolean;
    feedback?: Exclude<WorkoutSession["feedback"], undefined>;
    roundsCompleted?: number;
  },
): WorkoutSession {
  const completed = options?.completed ?? true;

  return {
    id: createId("session"),
    workoutPlanId: plan.id,
    workoutName: plan.name,
    startedAt,
    completedAt,
    completed,
    feedback: options?.feedback ?? (completed ? "ok" : undefined),
    roundsCompleted: options?.roundsCompleted ?? plan.rounds,
    steps,
  };
}
