import type { WorkoutSession, WorkoutSessionStep } from "../models/session";
import type { Language } from "../i18n/translations";
import { translateExerciseName } from "../i18n/exerciseNames";
import type { WorkoutPlan, WorkoutStep } from "../models/workout";
import { createId } from "../utils/id";

const voiceTemplates: Record<
  Language,
  {
    time: string[];
    reps: string[];
    break: string[];
    complete: string[];
  }
> = {
  en: {
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
    time: [
      "Prochain exercice, {exercise} pendant {duration} secondes.",
      "On y va. {exercise}, {duration} secondes.",
      "Prepare-toi pour {exercise}, {duration} secondes.",
    ],
    reps: [
      "Maintenant, {exercise}, {reps} repetitions.",
      "Prochain exercice, {exercise}, {reps} repetitions.",
      "Prepare-toi pour {exercise}, {reps} repetitions.",
    ],
    break: [
      "Pause, {break} secondes.",
      "Recupere maintenant, {break} secondes.",
      "Bien joue. Prends {break} secondes.",
    ],
    complete: [
      "Entrainement termine. Bien joue.",
      "Session terminee. Beau travail.",
      "Tres bon travail. Entrainement termine.",
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
): WorkoutSession {
  return {
    id: createId("session"),
    workoutPlanId: plan.id,
    workoutName: plan.name,
    startedAt,
    completedAt,
    completed: true,
    roundsCompleted: plan.rounds,
    steps,
  };
}
