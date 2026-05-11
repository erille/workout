import { defaultExercises } from "./defaultExercises";
import type { Exercise } from "../models/exercise";
import { defaultSettings, type AppSettings } from "../models/settings";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

const storageKeys = {
  exercises: "workout.exercises",
  plans: "workout.plans",
  sessions: "workout.sessions",
  settings: "workout.settings",
} as const;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  if (!canUseLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function getExercises(): Promise<Exercise[]> {
  const exercises = await readJson<Exercise[]>(storageKeys.exercises, []);

  if (exercises.length > 0) {
    return exercises;
  }

  await saveExercises(defaultExercises);
  return defaultExercises;
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  await writeJson(storageKeys.exercises, exercises);
}

export async function getWorkoutPlans(): Promise<WorkoutPlan[]> {
  return readJson<WorkoutPlan[]>(storageKeys.plans, []);
}

export async function saveWorkoutPlans(plans: WorkoutPlan[]): Promise<void> {
  await writeJson(storageKeys.plans, plans);
}

export async function getSessions(): Promise<WorkoutSession[]> {
  return readJson<WorkoutSession[]>(storageKeys.sessions, []);
}

export async function saveSessions(sessions: WorkoutSession[]): Promise<void> {
  await writeJson(storageKeys.sessions, sessions);
}

export async function getSettings(): Promise<AppSettings> {
  const savedSettings = await readJson<Partial<AppSettings>>(storageKeys.settings, {});
  return {
    ...defaultSettings,
    ...savedSettings,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(storageKeys.settings, settings);
}
