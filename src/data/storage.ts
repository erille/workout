import { defaultExercises } from "./defaultExercises";
import type { Exercise } from "../models/exercise";
import { defaultSettings, type AppSettings } from "../models/settings";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

export type StorageMode = "local" | "server";

type ServerData = {
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  settings: AppSettings;
};

const guestStorageKeys = {
  exercises: "workout.guest.exercises.v1",
  plans: "workout.guest.plans.v1",
  sessions: "workout.guest.sessions.v1",
  settings: "workout.guest.settings.v1",
} as const;

let serverDataPromise: Promise<ServerData> | null = null;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readLocalJson<T>(key: string, fallback: T): T {
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

function writeLocalJson<T>(key: string, value: T): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function loadServerData(): Promise<ServerData> {
  const apiData = await apiJson<ServerData>("/api/data");

  return {
    exercises: apiData.exercises,
    plans: apiData.plans,
    sessions: apiData.sessions,
    settings: {
      ...defaultSettings,
      ...apiData.settings,
    },
  };
}

function getServerData(): Promise<ServerData> {
  serverDataPromise ??= loadServerData();
  return serverDataPromise;
}

async function readServerData(): Promise<ServerData> {
  try {
    return await getServerData();
  } catch {
    return {
      exercises: defaultExercises,
      plans: [],
      sessions: [],
      settings: defaultSettings,
    };
  }
}

async function saveToServer<T>(path: string, value: T): Promise<void> {
  await apiJson(path, {
    method: "PUT",
    body: JSON.stringify(value),
  });
  serverDataPromise = null;
}

function getLocalExercises(): Exercise[] {
  const exercises = readLocalJson<Exercise[]>(guestStorageKeys.exercises, []);

  if (exercises.length > 0) {
    return exercises;
  }

  writeLocalJson(guestStorageKeys.exercises, defaultExercises);
  return defaultExercises;
}

export async function getExercises(mode: StorageMode): Promise<Exercise[]> {
  if (mode === "local") {
    return getLocalExercises();
  }

  return (await readServerData()).exercises;
}

export async function saveExercises(exercises: Exercise[], mode: StorageMode): Promise<void> {
  if (mode === "local") {
    writeLocalJson(guestStorageKeys.exercises, exercises);
    return;
  }

  await saveToServer("/api/exercises", exercises);
}

export async function getWorkoutPlans(mode: StorageMode): Promise<WorkoutPlan[]> {
  if (mode === "local") {
    return readLocalJson<WorkoutPlan[]>(guestStorageKeys.plans, []);
  }

  return (await readServerData()).plans;
}

export async function saveWorkoutPlans(plans: WorkoutPlan[], mode: StorageMode): Promise<void> {
  if (mode === "local") {
    writeLocalJson(guestStorageKeys.plans, plans);
    return;
  }

  await saveToServer("/api/plans", plans);
}

export async function getSessions(mode: StorageMode): Promise<WorkoutSession[]> {
  if (mode === "local") {
    return readLocalJson<WorkoutSession[]>(guestStorageKeys.sessions, []);
  }

  return (await readServerData()).sessions;
}

export async function saveSessions(sessions: WorkoutSession[], mode: StorageMode): Promise<void> {
  if (mode === "local") {
    writeLocalJson(guestStorageKeys.sessions, sessions);
    return;
  }

  await saveToServer("/api/sessions", sessions);
}

export async function getSettings(mode: StorageMode): Promise<AppSettings> {
  if (mode === "local") {
    return {
      ...defaultSettings,
      ...readLocalJson<Partial<AppSettings>>(guestStorageKeys.settings, {}),
    };
  }

  return (await readServerData()).settings;
}

export async function saveSettings(settings: AppSettings, mode: StorageMode): Promise<void> {
  if (mode === "local") {
    writeLocalJson(guestStorageKeys.settings, settings);
    return;
  }

  await saveToServer("/api/settings", settings);
}
