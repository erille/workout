import { defaultExercises } from "./defaultExercises";
import type { Exercise } from "../models/exercise";
import { defaultSettings, type AppSettings } from "../models/settings";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

type ServerData = {
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  settings: AppSettings;
};

const storageKeys = {
  exercises: "workout.exercises",
  plans: "workout.plans",
  sessions: "workout.sessions",
  settings: "workout.settings",
  serverMigrated: "workout.serverMigrated.v1",
} as const;

let serverDataPromise: Promise<ServerData | null> | null = null;

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

function localSnapshot(): ServerData {
  return {
    exercises: readLocalJson<Exercise[]>(storageKeys.exercises, []),
    plans: readLocalJson<WorkoutPlan[]>(storageKeys.plans, []),
    sessions: readLocalJson<WorkoutSession[]>(storageKeys.sessions, []),
    settings: {
      ...defaultSettings,
      ...readLocalJson<Partial<AppSettings>>(storageKeys.settings, {}),
    },
  };
}

function hasLocalWorkoutData(data: ServerData): boolean {
  return (
    data.exercises.length > 0 ||
    data.plans.length > 0 ||
    data.sessions.length > 0 ||
    canUseLocalStorage() && window.localStorage.getItem(storageKeys.settings) !== null
  );
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

async function loadServerData(): Promise<ServerData | null> {
  try {
    const apiData = await apiJson<ServerData>("/api/data");
    const localData = localSnapshot();
    const wasMigrated =
      canUseLocalStorage() && window.localStorage.getItem(storageKeys.serverMigrated) === "true";

    if (!wasMigrated && hasLocalWorkoutData(localData)) {
      const mergedData: ServerData = {
        exercises: localData.exercises.length > 0 ? localData.exercises : apiData.exercises,
        plans: localData.plans.length > 0 ? localData.plans : apiData.plans,
        sessions: localData.sessions.length > 0 ? localData.sessions : apiData.sessions,
        settings: {
          ...defaultSettings,
          ...apiData.settings,
          ...localData.settings,
        },
      };
      const importedData = await apiJson<ServerData>("/api/import", {
        method: "POST",
        body: JSON.stringify(mergedData),
      });

      if (canUseLocalStorage()) {
        window.localStorage.setItem(storageKeys.serverMigrated, "true");
      }

      return importedData;
    }

    if (canUseLocalStorage()) {
      window.localStorage.setItem(storageKeys.serverMigrated, "true");
    }

    return {
      ...apiData,
      settings: {
        ...defaultSettings,
        ...apiData.settings,
      },
    };
  } catch {
    return null;
  }
}

function getServerData(): Promise<ServerData | null> {
  serverDataPromise ??= loadServerData();
  return serverDataPromise;
}

function mirrorLocalData(data: Partial<ServerData>): void {
  if (data.exercises) {
    writeLocalJson(storageKeys.exercises, data.exercises);
  }

  if (data.plans) {
    writeLocalJson(storageKeys.plans, data.plans);
  }

  if (data.sessions) {
    writeLocalJson(storageKeys.sessions, data.sessions);
  }

  if (data.settings) {
    writeLocalJson(storageKeys.settings, data.settings);
  }
}

async function saveToServer<T>(path: string, value: T): Promise<boolean> {
  try {
    await apiJson(path, {
      method: "PUT",
      body: JSON.stringify(value),
    });
    return true;
  } catch {
    return false;
  }
}

export async function getExercises(): Promise<Exercise[]> {
  const serverData = await getServerData();

  if (serverData) {
    mirrorLocalData({ exercises: serverData.exercises });
    return serverData.exercises;
  }

  const exercises = readLocalJson<Exercise[]>(storageKeys.exercises, []);

  if (exercises.length > 0) {
    return exercises;
  }

  void saveExercises(defaultExercises);
  return defaultExercises;
}

export async function saveExercises(exercises: Exercise[]): Promise<void> {
  mirrorLocalData({ exercises });

  if (await saveToServer("/api/exercises", exercises)) {
    serverDataPromise = null;
  }
}

export async function getWorkoutPlans(): Promise<WorkoutPlan[]> {
  const serverData = await getServerData();

  if (serverData) {
    mirrorLocalData({ plans: serverData.plans });
    return serverData.plans;
  }

  return readLocalJson<WorkoutPlan[]>(storageKeys.plans, []);
}

export async function saveWorkoutPlans(plans: WorkoutPlan[]): Promise<void> {
  mirrorLocalData({ plans });

  if (await saveToServer("/api/plans", plans)) {
    serverDataPromise = null;
  }
}

export async function getSessions(): Promise<WorkoutSession[]> {
  const serverData = await getServerData();

  if (serverData) {
    mirrorLocalData({ sessions: serverData.sessions });
    return serverData.sessions;
  }

  return readLocalJson<WorkoutSession[]>(storageKeys.sessions, []);
}

export async function saveSessions(sessions: WorkoutSession[]): Promise<void> {
  mirrorLocalData({ sessions });

  if (await saveToServer("/api/sessions", sessions)) {
    serverDataPromise = null;
  }
}

export async function getSettings(): Promise<AppSettings> {
  const serverData = await getServerData();

  if (serverData) {
    mirrorLocalData({ settings: serverData.settings });
    return {
      ...defaultSettings,
      ...serverData.settings,
    };
  }

  return {
    ...defaultSettings,
    ...readLocalJson<Partial<AppSettings>>(storageKeys.settings, {}),
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  mirrorLocalData({ settings });

  if (await saveToServer("/api/settings", settings)) {
    serverDataPromise = null;
  }
}
