import type { WorkoutSession, WorkoutSessionStep } from "../models/session";
import type { WorkoutPlan, WorkoutStep } from "../models/workout";
import { createId } from "../utils/id";

const timeExerciseTemplates = [
  "Next, {exercise} for {duration} seconds.",
  "Let's go. {exercise}, {duration} seconds.",
  "Get ready for {exercise}, {duration} seconds.",
];

const repsExerciseTemplates = [
  "Now let's do {exercise}, {reps} reps.",
  "Next, {exercise}, {reps} strong reps.",
  "Get ready for {exercise}, {reps} reps.",
];

const breakTemplates = [
  "Break time, {break} seconds.",
  "Recover now, {break} seconds.",
  "Nice work. Take {break} seconds.",
];

const completeTemplates = [
  "Workout complete. Great job.",
  "Session finished. Well done.",
  "Great work. Workout complete.",
];

function pickTemplate(templates: string[], seed: number): string {
  return templates[Math.abs(seed) % templates.length] ?? templates[0];
}

export function getStepAnnouncement(step: WorkoutStep): string {
  if (step.type === "time") {
    return pickTemplate(timeExerciseTemplates, step.exerciseName.length + step.durationSeconds)
      .replace("{exercise}", step.exerciseName)
      .replace("{duration}", String(step.durationSeconds));
  }

  return pickTemplate(repsExerciseTemplates, step.exerciseName.length + step.reps)
    .replace("{exercise}", step.exerciseName)
    .replace("{reps}", String(step.reps));
}

export function getBreakAnnouncement(breakSeconds: number): string {
  return pickTemplate(breakTemplates, breakSeconds).replace("{break}", String(breakSeconds));
}

export function getCompleteAnnouncement(): string {
  return pickTemplate(completeTemplates, Date.now());
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

export function createSessionStep(step: WorkoutStep, round: number): WorkoutSessionStep {
  return {
    id: createId("session-step"),
    exerciseId: step.exerciseId,
    exerciseName: step.exerciseName,
    type: step.type,
    durationSeconds: step.type === "time" ? step.durationSeconds : undefined,
    reps: step.type === "reps" ? step.reps : undefined,
    breakSeconds: step.breakSeconds,
    weight: step.weight,
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
