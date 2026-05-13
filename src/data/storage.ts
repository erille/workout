import { defaultExercises } from "./defaultExercises";
import type { Exercise } from "../models/exercise";
import { defaultProfile, type CharacterProfile } from "../models/profile";
import { defaultSettings, type AppSettings, type NotificationMode } from "../models/settings";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

export type StorageMode = "local" | "server";

type ServerData = {
  exercises: Exercise[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  settings: AppSettings;
  profile: CharacterProfile;
};

export type QuickTimerSettings = {
  name: string;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
};

export const defaultQuickTimerSettings: QuickTimerSettings = {
  name: "Quick interval",
  workSeconds: 45,
  restSeconds: 15,
  rounds: 8,
};

const guestStorageKeys = {
  exercises: "workout.guest.exercises.v1",
  plans: "workout.guest.plans.v1",
  sessions: "workout.guest.sessions.v1",
  settings: "workout.guest.settings.v1",
  profile: "workout.guest.profile.v1",
  quickTimer: "workout.guest.quickTimer.v1",
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
    settings: normalizeSettings(apiData.settings),
    profile: normalizeProfile(apiData.profile),
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
      settings: normalizeSettings(),
      profile: defaultProfile,
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

function normalizeProfile(profile?: Partial<CharacterProfile>): CharacterProfile {
  return {
    ...defaultProfile,
    ...profile,
    avatar: {
      ...defaultProfile.avatar,
      ...profile?.avatar,
    },
    measurements: Array.isArray(profile?.measurements) ? profile.measurements : [],
  };
}

function normalizeNotificationMode(settings?: Partial<AppSettings>): NotificationMode {
  if (
    settings?.notificationMode === "voice" ||
    settings?.notificationMode === "beep" ||
    settings?.notificationMode === "off"
  ) {
    return settings.notificationMode;
  }

  return settings?.voiceEnabled === false ? "off" : defaultSettings.notificationMode;
}

function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  const notificationMode = normalizeNotificationMode(settings);

  return {
    ...defaultSettings,
    ...settings,
    notificationMode,
    voiceEnabled: notificationMode === "voice",
  };
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
    return normalizeSettings(readLocalJson<Partial<AppSettings>>(guestStorageKeys.settings, {}));
  }

  return normalizeSettings((await readServerData()).settings);
}

export async function saveSettings(settings: AppSettings, mode: StorageMode): Promise<void> {
  const normalizedSettings = normalizeSettings(settings);

  if (mode === "local") {
    writeLocalJson(guestStorageKeys.settings, normalizedSettings);
    return;
  }

  await saveToServer("/api/settings", normalizedSettings);
}

export async function getProfile(mode: StorageMode): Promise<CharacterProfile> {
  if (mode === "local") {
    return normalizeProfile(readLocalJson<Partial<CharacterProfile>>(guestStorageKeys.profile, {}));
  }

  return (await readServerData()).profile;
}

export async function saveProfile(profile: CharacterProfile, mode: StorageMode): Promise<void> {
  const normalizedProfile = normalizeProfile(profile);

  if (mode === "local") {
    writeLocalJson(guestStorageKeys.profile, normalizedProfile);
    return;
  }

  await saveToServer("/api/profile", normalizedProfile);
}

function normalizeQuickTimerSettings(
  settings?: Partial<QuickTimerSettings>,
): QuickTimerSettings {
  const positiveInteger = (value: unknown, fallback: number, minimum: number) => {
    const parsedValue = Math.round(Number(value));

    return Number.isFinite(parsedValue) ? Math.max(minimum, parsedValue) : fallback;
  };

  return {
    name: settings?.name?.trim() || defaultQuickTimerSettings.name,
    workSeconds: positiveInteger(settings?.workSeconds, defaultQuickTimerSettings.workSeconds, 1),
    restSeconds: positiveInteger(settings?.restSeconds, defaultQuickTimerSettings.restSeconds, 0),
    rounds: positiveInteger(settings?.rounds, defaultQuickTimerSettings.rounds, 1),
  };
}

export async function getQuickTimerSettings(): Promise<QuickTimerSettings> {
  return normalizeQuickTimerSettings(
    readLocalJson<Partial<QuickTimerSettings>>(guestStorageKeys.quickTimer, defaultQuickTimerSettings),
  );
}

export async function saveQuickTimerSettings(settings: QuickTimerSettings): Promise<void> {
  writeLocalJson(guestStorageKeys.quickTimer, normalizeQuickTimerSettings(settings));
}
