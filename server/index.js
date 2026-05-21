import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import argon2 from "argon2";
import { defaultExercises, defaultProfile, defaultSettings } from "./defaultData.js";
import { createTtsAudio, getTtsStatus, streamTtsAudio } from "./ttsService.js";

function loadDotEnv() {
  const envPath = resolve(".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadDotEnv();

const port = Number(process.env.PORT ?? 8060);
const publicDir = resolve(process.env.WORKOUT_PUBLIC_DIR ?? "dist");
const dbPath = resolve(process.env.WORKOUT_DB_PATH ?? join("data", "workout.sqlite"));
const passwordHash = process.env.WORKOUT_PASSWORD_HASH?.trim() || "";
const authEnabled = passwordHash.length > 0;
const authSecret = process.env.WORKOUT_AUTH_SECRET?.trim() || passwordHash || "workout-dev-secret";
const sessionCookieName = "workout_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;
const allowedTables = new Set(["exercises", "plans", "sessions"]);
const exerciseDefaultsVersion = 1;
const defaultTimeSeconds = 45;
const defaultReps = 20;
const defaultDistanceMeters = 500;
const supportedCoachProviders = new Set(["openai", "openrouter"]);
const requestedCoachProvider = (process.env.COACH_PROVIDER ?? "openai").trim().toLowerCase();
const coachProvider = supportedCoachProviders.has(requestedCoachProvider)
  ? requestedCoachProvider
  : "openai";
const openAiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const openRouterModel = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4.1-mini";
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim() || "";

mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coach_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    provider TEXT,
    model TEXT
  );
`);

function jsonResponse(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function emptyResponse(response, statusCode = 204) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  });
  response.end();
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        const key = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
        const value = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : "";
        return [key, decodeURIComponent(value)];
      }),
  );
}

function signPayload(payload) {
  return createHmac("sha256", authSecret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + sessionMaxAgeSeconds * 1000 }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function isAuthenticated(request) {
  if (!authEnabled) {
    return true;
  }

  const token = parseCookies(request.headers.cookie)[sessionCookieName];

  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEqual(signPayload(payload), signature)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof session.exp === "number" && session.exp > Date.now();
  } catch {
    return false;
  }
}

function sessionCookie(value, maxAge = sessionMaxAgeSeconds) {
  const secureFlag = process.env.WORKOUT_COOKIE_SECURE === "true" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureFlag}`;
}

async function handleAuth(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/auth/status") {
    jsonResponse(response, 200, {
      authEnabled,
      authenticated: isAuthenticated(request),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    if (!authEnabled) {
      jsonResponse(response, 200, { authEnabled, authenticated: true });
      return true;
    }

    const body = await readBody(request);
    const password = body && typeof body.password === "string" ? body.password : "";
    const verified = password.length > 0 && (await argon2.verify(passwordHash, password));

    if (!verified) {
      jsonResponse(response, 401, { error: "Invalid password" });
      return true;
    }

    jsonResponse(
      response,
      200,
      { authEnabled, authenticated: true },
      { "Set-Cookie": sessionCookie(createSessionToken()) },
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    jsonResponse(
      response,
      200,
      { authEnabled, authenticated: false },
      { "Set-Cookie": sessionCookie("", 0) },
    );
    return true;
  }

  return false;
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 2_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : null);
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function tableName(table) {
  if (!allowedTables.has(table)) {
    throw new Error(`Unsupported table: ${table}`);
  }

  return table;
}

function readCollection(table) {
  const resolvedTable = tableName(table);
  return db
    .prepare(`SELECT data FROM ${resolvedTable} ORDER BY updated_at DESC`)
    .all()
    .map((row) => JSON.parse(row.data));
}

function writeCollection(table, items) {
  if (!Array.isArray(items)) {
    throw new Error(`${table} payload must be an array.`);
  }

  const resolvedTable = tableName(table);
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO ${resolvedTable} (id, data, updated_at) VALUES (?, ?, ?)`,
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`DELETE FROM ${resolvedTable}`).run();

    for (const item of items) {
      if (!item || typeof item.id !== "string" || item.id.trim().length === 0) {
        throw new Error(`${table} items must have an id.`);
      }

      insert.run(item.id, JSON.stringify(item), item.updatedAt ?? item.completedAt ?? now);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function applyExerciseDefaultTargets(exercises) {
  return exercises.map((exercise) => {
    if (exercise.defaultMode === "time") {
      return {
        ...exercise,
        defaultDurationSeconds: defaultTimeSeconds,
      };
    }

    if (exercise.defaultMode === "reps") {
      return {
        ...exercise,
        defaultReps,
      };
    }

    return exercise;
  });
}

function normalizeCategoryInput(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function isDefaultExerciseCategory(categoryId) {
  return defaultSettings.exerciseCategories.some((category) => category.id === categoryId);
}

function cloneExerciseCategory(category) {
  return {
    id: category.id,
    labels: { ...(category.labels ?? {}) },
  };
}

function normalizeExerciseCategories(categories, fallbackLanguage = "fr") {
  const normalizedCategories = (Array.isArray(categories) ? categories : [])
    .map((category) => {
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

      const id =
        typeof category.id === "string" ? normalizeCategoryInput(category.id) : "";

      if (!id) {
        return null;
      }

      const rawLabels =
        category.labels && typeof category.labels === "object" && !Array.isArray(category.labels)
          ? category.labels
          : {};
      const labels = {};

      ["en", "fr"].forEach((language) => {
        const label =
          typeof rawLabels[language] === "string"
            ? normalizeCategoryInput(rawLabels[language])
            : "";

        if (label) {
          labels[language] = label;
        }
      });

      return { id, labels };
    })
    .filter(Boolean)
    .filter((category, index, allCategories) => {
      const normalizedCategory = category.id.toLowerCase();
      return (
        allCategories.findIndex((item) => item.id.toLowerCase() === normalizedCategory) === index
      );
    });

  return normalizedCategories.length > 0
    ? normalizedCategories
    : defaultSettings.exerciseCategories.map(cloneExerciseCategory);
}

function readSettings() {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
  const savedSettings = row ? JSON.parse(row.data) : {};
  const notificationMode =
    savedSettings.notificationMode ??
    (savedSettings.voiceEnabled === false ? "off" : defaultSettings.notificationMode);
  const voiceProvider =
    savedSettings.voiceProvider === "browser" || savedSettings.voiceProvider === "piper"
      ? savedSettings.voiceProvider
      : defaultSettings.voiceProvider;
  const voiceLanguage =
    savedSettings.voiceLanguage === "app" ||
    savedSettings.voiceLanguage === "en" ||
    savedSettings.voiceLanguage === "fr"
      ? savedSettings.voiceLanguage
      : defaultSettings.voiceLanguage;
  const language =
    savedSettings.language === "en" || savedSettings.language === "fr"
      ? savedSettings.language
      : defaultSettings.language;
  const savedExerciseDefaultsVersion = Number.isFinite(savedSettings.exerciseDefaultsVersion)
    ? Math.max(0, Math.round(Number(savedSettings.exerciseDefaultsVersion)))
    : 0;
  const exerciseCategories = normalizeExerciseCategories(savedSettings.exerciseCategories, language);

  return {
    ...defaultSettings,
    ...savedSettings,
    notificationMode,
    voiceProvider,
    voiceLanguage,
    voiceEnabled: notificationMode === "voice",
    language,
    exerciseDefaultsVersion: savedExerciseDefaultsVersion,
    exerciseCategories,
  };
}

function writeSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Settings payload must be an object.");
  }

  const notificationMode =
    settings.notificationMode ??
    (settings.voiceEnabled === false ? "off" : defaultSettings.notificationMode);
  const voiceProvider =
    settings.voiceProvider === "browser" || settings.voiceProvider === "piper"
      ? settings.voiceProvider
      : defaultSettings.voiceProvider;
  const voiceLanguage =
    settings.voiceLanguage === "app" ||
    settings.voiceLanguage === "en" ||
    settings.voiceLanguage === "fr"
      ? settings.voiceLanguage
      : defaultSettings.voiceLanguage;
  const language =
    settings.language === "en" || settings.language === "fr"
      ? settings.language
      : defaultSettings.language;
  const nextExerciseDefaultsVersion = Number.isFinite(settings.exerciseDefaultsVersion)
    ? Math.max(0, Math.round(Number(settings.exerciseDefaultsVersion)))
    : defaultSettings.exerciseDefaultsVersion;
  const exerciseCategories = normalizeExerciseCategories(settings.exerciseCategories, language);

  db.prepare(
    `INSERT INTO settings (id, data, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify({
    ...defaultSettings,
    ...settings,
    notificationMode,
    voiceProvider,
    voiceLanguage,
    voiceEnabled: notificationMode === "voice",
    language,
    exerciseDefaultsVersion: nextExerciseDefaultsVersion,
    exerciseCategories,
  }), new Date().toISOString());
}

function normalizeProfile(profile) {
  return {
    ...defaultProfile,
    ...(profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {}),
    avatar: {
      ...defaultProfile.avatar,
      ...(profile?.avatar && typeof profile.avatar === "object" && !Array.isArray(profile.avatar)
        ? profile.avatar
        : {}),
    },
    measurements: Array.isArray(profile?.measurements) ? profile.measurements : [],
  };
}

function readProfile() {
  const row = db.prepare("SELECT data FROM profile WHERE id = 1").get();

  return normalizeProfile(row ? JSON.parse(row.data) : defaultProfile);
}

function writeProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("Profile payload must be an object.");
  }

  const normalizedProfile = normalizeProfile(profile);
  db.prepare(
    `INSERT INTO profile (id, data, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(normalizedProfile), normalizedProfile.updatedAt ?? new Date().toISOString());
}

function seedDefaults() {
  const exerciseCount = db.prepare("SELECT COUNT(*) AS count FROM exercises").get().count;

  if (exerciseCount === 0) {
    writeCollection("exercises", defaultExercises);
  }

  const settingsCount = db.prepare("SELECT COUNT(*) AS count FROM settings").get().count;

  if (settingsCount === 0) {
    writeSettings(defaultSettings);
  }

  const profileCount = db.prepare("SELECT COUNT(*) AS count FROM profile").get().count;

  if (profileCount === 0) {
    writeProfile(defaultProfile);
  }
}

function readAllData() {
  seedDefaults();
  const settings = readSettings();
  let exercises = readCollection("exercises");

  if (settings.exerciseDefaultsVersion < exerciseDefaultsVersion) {
    exercises = applyExerciseDefaultTargets(exercises);
    writeCollection("exercises", exercises);
    settings.exerciseDefaultsVersion = exerciseDefaultsVersion;
    writeSettings(settings);
  }

  return {
    exercises,
    plans: readCollection("plans"),
    sessions: readCollection("sessions"),
    settings,
    profile: readProfile(),
  };
}

function writeAllData(data) {
  const settings = data.settings ?? defaultSettings;
  const importedExerciseDefaultsVersion = Number.isFinite(settings.exerciseDefaultsVersion)
    ? Math.max(0, Math.round(Number(settings.exerciseDefaultsVersion)))
    : 0;
  const exercises =
    importedExerciseDefaultsVersion < exerciseDefaultsVersion
      ? applyExerciseDefaultTargets(data.exercises ?? [])
      : data.exercises ?? [];

  writeCollection("exercises", exercises);
  writeCollection("plans", data.plans ?? []);
  writeCollection("sessions", data.sessions ?? []);
  writeSettings({
    ...settings,
    exerciseDefaultsVersion: Math.max(importedExerciseDefaultsVersion, exerciseDefaultsVersion),
  });
  writeProfile(data.profile ?? defaultProfile);
}

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function getCoachConfig() {
  if (coachProvider === "openrouter") {
    return {
      enabled: openRouterApiKey.length > 0,
      provider: "openrouter",
      model: openRouterModel,
      apiKey: openRouterApiKey,
      reason: openRouterApiKey ? undefined : "OPENROUTER_API_KEY is not configured.",
    };
  }

  return {
    enabled: openAiApiKey.length > 0,
    provider: "openai",
    model: openAiModel,
    apiKey: openAiApiKey,
    reason: openAiApiKey ? undefined : "OPENAI_API_KEY is not configured.",
  };
}

function readCoachMessages(limit = 80) {
  const resolvedLimit = Math.max(1, Math.min(200, Math.round(Number(limit) || 80)));

  return db
    .prepare(
      `SELECT id, role, content, created_at AS createdAt, provider, model
       FROM coach_messages
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(resolvedLimit)
    .reverse();
}

function writeCoachMessage(role, content, provider, model) {
  const message = {
    id: createId("coach-message"),
    role,
    content,
    createdAt: new Date().toISOString(),
    provider,
    model,
  };

  db.prepare(
    `INSERT INTO coach_messages (id, role, content, created_at, provider, model)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(message.id, role, content, message.createdAt, provider ?? null, model ?? null);

  return message;
}

function clearCoachMessages() {
  db.prepare("DELETE FROM coach_messages").run();
}

function createCoachSystemPrompt(language) {
  const responseLanguage = language === "en" ? "English" : "French";

  return [
    `You are the virtual workout coach inside the Workout app. Answer in ${responseLanguage}.`,
    "Be practical, concise, encouraging, and specific. Use the user's app data through tools before giving plans or progress advice.",
    "You can discuss workout planning, recovery, motivation, and general non-medical nutrition guidance.",
    "Do not diagnose or treat medical issues. If the user mentions pain, injury, dizziness, chest pain, or medical symptoms, advise stopping the workout when appropriate and consulting a qualified professional.",
    "Prefer existing exercises and categories. If something important is missing, create a category first, then create the exercise.",
    "When the user asks you to create a workout/build, create it directly with the create_build tool. Do not ask for user confirmation unless required details are missing.",
    "You may create categories, exercises, and builds only. Never delete or overwrite existing user data.",
  ].join("\n");
}

function numberInRange(value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function optionalNumber(value, minimum = 0) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : undefined;
}

function normalizeKey(value) {
  return normalizeCategoryInput(value).toLowerCase();
}

function createSlug(value, fallbackPrefix) {
  const slug = normalizeCategoryInput(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `${fallbackPrefix}-${Date.now()}`;
}

function uniqueCategoryId(label, categories) {
  const baseId = createSlug(label, "category");
  const existingIds = new Set(categories.map((category) => category.id.toLowerCase()));
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId.toLowerCase())) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function findCategory(settings, query) {
  const normalizedQuery = normalizeKey(query);

  if (!normalizedQuery) {
    return undefined;
  }

  return settings.exerciseCategories.find((category) => {
    const labels = [
      category.id,
      category.labels?.en ?? "",
      category.labels?.fr ?? "",
    ];

    return labels.some((label) => normalizeKey(label) === normalizedQuery);
  });
}

function ensureCategory(name, language, labels = {}) {
  const settings = readSettings();
  const label =
    normalizeCategoryInput(labels[language] ?? name ?? labels.fr ?? labels.en ?? "");

  if (!label) {
    throw new Error("Category name is required.");
  }

  const existingCategory = findCategory(settings, label);

  if (existingCategory) {
    return { category: existingCategory, created: false };
  }

  const category = {
    id: uniqueCategoryId(label, settings.exerciseCategories),
    labels: {
      ...(labels.en ? { en: normalizeCategoryInput(labels.en) } : {}),
      ...(labels.fr ? { fr: normalizeCategoryInput(labels.fr) } : {}),
      [language]: label,
    },
  };
  const exerciseCategories = normalizeExerciseCategories(
    [...settings.exerciseCategories, category],
    language,
  );

  writeSettings({
    ...settings,
    exerciseCategories,
  });

  return { category, created: true };
}

function findExercise(exercises, query) {
  const normalizedQuery = normalizeKey(query);

  if (!normalizedQuery) {
    return undefined;
  }

  return exercises.find(
    (exercise) =>
      normalizeKey(exercise.id) === normalizedQuery ||
      normalizeKey(exercise.name) === normalizedQuery,
  );
}

function getWorkoutStats() {
  const sessions = readCollection("sessions");
  const now = new Date();
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };
  const startOfWeek = (date) => {
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    return addDays(startOfDay(date), offset);
  };
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const countInRange = (start, end) =>
    sessions.filter((session) => {
      const startedAt = new Date(session.startedAt);
      return startedAt >= start && startedAt < end;
    }).length;

  return {
    totalSessions: sessions.length,
    completedSessions: sessions.filter((session) => session.completed).length,
    partialSessions: sessions.filter((session) => !session.completed).length,
    thisWeek: countInRange(weekStart, weekEnd),
    thisMonth: countInRange(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    thisYear: countInRange(yearStart, new Date(now.getFullYear() + 1, 0, 1)),
    recentSessions: sessions.slice(0, 10).map((session) => ({
      workoutName: session.workoutName,
      startedAt: session.startedAt,
      completed: session.completed,
      roundsCompleted: session.roundsCompleted,
      steps: session.steps.length,
    })),
  };
}

function summarizeTarget(step) {
  if (step.type === "time") {
    return `${step.durationSeconds}s`;
  }

  if (step.type === "distance") {
    return `${step.distanceMeters}m`;
  }

  return `${step.reps} reps`;
}

const coachTools = [
  {
    type: "function",
    function: {
      name: "get_profile",
      description: "Get the user profile and latest measurement history.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workout_stats",
      description: "Get workout frequency and recent activity statistics.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_sessions",
      description: "Get recent workout history with completed steps.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum sessions to return, up to 20." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "List exercise categories.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_exercises",
      description: "List available exercises and their defaults.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_builds",
      description: "List saved workout builds/plans.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_category",
      description: "Create a new exercise category. Use before creating exercises that need it.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          labels: {
            type: "object",
            properties: {
              en: { type: "string" },
              fr: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_exercise",
      description: "Create an exercise in the library. Returns an existing exercise if the name already exists.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          categoryId: { type: "string" },
          categoryName: { type: "string" },
          defaultMode: { type: "string", enum: ["time", "reps", "distance"] },
          defaultDurationSeconds: { type: "number" },
          defaultReps: { type: "number" },
          defaultDistanceMeters: { type: "number" },
          notes: { type: "string" },
        },
        required: ["name", "defaultMode"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_build",
      description: "Create and save a workout Build directly.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          rounds: { type: "number" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                exerciseId: { type: "string" },
                exerciseName: { type: "string" },
                type: { type: "string", enum: ["time", "reps", "distance"] },
                durationSeconds: { type: "number" },
                reps: { type: "number" },
                distanceMeters: { type: "number" },
                breakSeconds: { type: "number" },
                weight: { type: "number" },
              },
              additionalProperties: false,
            },
          },
        },
        required: ["name", "rounds", "steps"],
        additionalProperties: false,
      },
    },
  },
];

function executeCoachTool(name, args, language) {
  if (name === "get_profile") {
    const profile = readProfile();
    const measurements = [...profile.measurements]
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
      .slice(0, 12);

    return { dataChanged: false, result: { ...profile, measurements } };
  }

  if (name === "get_workout_stats") {
    return { dataChanged: false, result: getWorkoutStats() };
  }

  if (name === "get_recent_sessions") {
    const limit = Math.max(1, Math.min(20, Math.round(Number(args.limit) || 10)));
    const sessions = readCollection("sessions").slice(0, limit).map((session) => ({
      id: session.id,
      workoutPlanId: session.workoutPlanId,
      workoutName: session.workoutName,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      completed: session.completed,
      roundsCompleted: session.roundsCompleted,
      steps: session.steps.map((step) => ({
        exerciseName: step.exerciseName,
        type: step.type,
        target: summarizeTarget(step),
        breakSeconds: step.breakSeconds,
        weight: step.weight,
        round: step.round,
      })),
    }));

    return { dataChanged: false, result: sessions };
  }

  if (name === "list_categories") {
    return { dataChanged: false, result: readSettings().exerciseCategories };
  }

  if (name === "list_exercises") {
    return {
      dataChanged: false,
      result: readCollection("exercises").map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        category: exercise.category,
        defaultMode: exercise.defaultMode,
        defaultDurationSeconds: exercise.defaultDurationSeconds,
        defaultReps: exercise.defaultReps,
        defaultDistanceMeters: exercise.defaultDistanceMeters,
        notes: exercise.notes,
      })),
    };
  }

  if (name === "list_builds") {
    return {
      dataChanged: false,
      result: readCollection("plans").map((plan) => ({
        id: plan.id,
        name: plan.name,
        rounds: plan.rounds,
        steps: plan.steps.map((step) => ({
          exerciseId: step.exerciseId,
          exerciseName: step.exerciseName,
          type: step.type,
          target: summarizeTarget(step),
          breakSeconds: step.breakSeconds,
          weight: step.weight,
        })),
      })),
    };
  }

  if (name === "create_category") {
    const { category, created } = ensureCategory(args.name, language, args.labels ?? {});
    return { dataChanged: created, result: { category, created } };
  }

  if (name === "create_exercise") {
    const exerciseName = normalizeCategoryInput(args.name ?? "");

    if (!exerciseName) {
      throw new Error("Exercise name is required.");
    }

    const exercises = readCollection("exercises");
    const existingExercise = findExercise(exercises, exerciseName);

    if (existingExercise) {
      return { dataChanged: false, result: { exercise: existingExercise, created: false } };
    }

    const settings = readSettings();
    let category = args.categoryId ? findCategory(settings, args.categoryId) : undefined;
    let categoryCreated = false;

    if (!category && args.categoryName) {
      const createdCategory = ensureCategory(args.categoryName, language);
      category = createdCategory.category;
      categoryCreated = createdCategory.created;
    }

    if (!category) {
      category = findCategory(readSettings(), "other") ?? readSettings().exerciseCategories[0];
    }

    if (!category) {
      throw new Error("No category is available for this exercise.");
    }

    const mode = ["time", "reps", "distance"].includes(args.defaultMode)
      ? args.defaultMode
      : "reps";
    const now = new Date().toISOString();
    const exercise = {
      id: createId("exercise"),
      name: exerciseName,
      category: category.id,
      defaultMode: mode,
      defaultDurationSeconds:
        mode === "time"
          ? numberInRange(args.defaultDurationSeconds, defaultTimeSeconds, 1)
          : undefined,
      defaultReps:
        mode === "reps" ? numberInRange(args.defaultReps, defaultReps, 1) : undefined,
      defaultDistanceMeters:
        mode === "distance"
          ? numberInRange(args.defaultDistanceMeters, defaultDistanceMeters, 1)
          : undefined,
      notes: typeof args.notes === "string" && args.notes.trim() ? args.notes.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    writeCollection("exercises", [exercise, ...exercises]);
    return {
      dataChanged: true,
      result: { exercise, created: true, categoryCreated },
    };
  }

  if (name === "create_build") {
    const buildName = normalizeCategoryInput(args.name ?? "");
    const rounds = numberInRange(args.rounds, 1, 1, 20);
    const rawSteps = Array.isArray(args.steps) ? args.steps : [];

    if (!buildName) {
      throw new Error("Build name is required.");
    }

    if (rawSteps.length === 0) {
      throw new Error("A build needs at least one step.");
    }

    const exercises = readCollection("exercises");
    const steps = rawSteps.map((step, index) => {
      const exercise =
        (step.exerciseId ? findExercise(exercises, step.exerciseId) : undefined) ??
        (step.exerciseName ? findExercise(exercises, step.exerciseName) : undefined);

      if (!exercise) {
        throw new Error(`Step ${index + 1} references an unknown exercise.`);
      }

      const type = ["time", "reps", "distance"].includes(step.type)
        ? step.type
        : exercise.defaultMode;
      const common = {
        id: createId("step"),
        type,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        breakSeconds: numberInRange(step.breakSeconds, 0, 0, 3600),
        weight: optionalNumber(step.weight, 0),
      };

      if (type === "time") {
        return {
          ...common,
          durationSeconds: numberInRange(
            step.durationSeconds,
            exercise.defaultDurationSeconds ?? defaultTimeSeconds,
            1,
          ),
        };
      }

      if (type === "distance") {
        return {
          ...common,
          distanceMeters: numberInRange(
            step.distanceMeters,
            exercise.defaultDistanceMeters ?? defaultDistanceMeters,
            1,
          ),
        };
      }

      return {
        ...common,
        reps: numberInRange(step.reps, exercise.defaultReps ?? defaultReps, 1),
      };
    });
    const now = new Date().toISOString();
    const plan = {
      id: createId("plan"),
      name: buildName,
      rounds,
      steps,
      createdAt: now,
      updatedAt: now,
    };

    writeCollection("plans", [plan, ...readCollection("plans")]);
    return { dataChanged: true, result: { plan, created: true } };
  }

  throw new Error(`Unsupported coach tool: ${name}`);
}

async function requestCoachCompletion(config, messages) {
  const endpoint =
    config.provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL?.trim() || "http://localhost:8060";
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME?.trim() || "Workout";
  }

  const apiResponse = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: coachTools,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`Coach provider error (${apiResponse.status}): ${errorText}`);
  }

  const payload = await apiResponse.json();
  const message = payload?.choices?.[0]?.message;

  if (!message) {
    throw new Error("Coach provider returned no message.");
  }

  return message;
}

async function runCoachConversation(userMessages, language) {
  const config = getCoachConfig();

  if (!config.enabled) {
    throw new Error(config.reason ?? "Coach provider is not configured.");
  }

  const messages = [
    { role: "system", content: createCoachSystemPrompt(language) },
    ...userMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
  let dataChanged = false;

  for (let toolRound = 0; toolRound < 6; toolRound += 1) {
    const assistantMessage = await requestCoachCompletion(config, messages);
    const toolCalls = Array.isArray(assistantMessage.tool_calls)
      ? assistantMessage.tool_calls
      : [];

    if (toolCalls.length === 0) {
      return {
        content:
          typeof assistantMessage.content === "string" && assistantMessage.content.trim()
            ? assistantMessage.content.trim()
            : "Je n'ai pas pu générer une réponse exploitable.",
        dataChanged,
        provider: config.provider,
        model: config.model,
      };
    }

    messages.push({
      role: "assistant",
      content: assistantMessage.content ?? "",
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name;
      let args = {};

      try {
        args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
        const toolResult = executeCoachTool(toolName, args, language);
        dataChanged = dataChanged || toolResult.dataChanged;
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ ok: true, result: toolResult.result }),
        });
      } catch (error) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "Tool failed.",
          }),
        });
      }
    }
  }

  return {
    content: "J'ai atteint la limite d'actions pour cette réponse. Essaie de reformuler en une demande plus courte.",
    dataChanged,
    provider: config.provider,
    model: config.model,
  };
}

async function handleCoachApi(request, response, pathname) {
  const config = getCoachConfig();

  if (request.method === "GET" && pathname === "/api/coach/status") {
    jsonResponse(response, 200, {
      enabled: config.enabled,
      provider: config.provider,
      model: config.model,
      reason: config.enabled ? undefined : config.reason,
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/coach/messages") {
    jsonResponse(response, 200, { messages: readCoachMessages() });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/coach/clear") {
    clearCoachMessages();
    jsonResponse(response, 200, { messages: [] });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/coach/chat") {
    if (!config.enabled) {
      jsonResponse(response, 503, {
        error: config.reason ?? "Coach provider is not configured.",
        enabled: false,
      });
      return true;
    }

    const body = await readBody(request);
    const content = typeof body?.message === "string" ? body.message.trim() : "";
    const language = body?.language === "en" ? "en" : "fr";

    if (!content) {
      jsonResponse(response, 400, { error: "Message is required." });
      return true;
    }

    writeCoachMessage("user", content, config.provider, config.model);
    const conversation = readCoachMessages(30);
    const result = await runCoachConversation(conversation, language);
    writeCoachMessage("assistant", result.content, result.provider, result.model);

    jsonResponse(response, 200, {
      message: result.content,
      messages: readCoachMessages(),
      dataChanged: result.dataChanged,
      provider: result.provider,
      model: result.model,
    });
    return true;
  }

  return false;
}

async function handleApi(request, response, pathname) {
  if (request.method === "OPTIONS") {
    emptyResponse(response);
    return;
  }

  if (await handleAuth(request, response, pathname)) {
    return;
  }

  if (request.method === "GET" && pathname === "/api/health") {
    jsonResponse(response, 200, { ok: true });
    return;
  }

  if (!isAuthenticated(request)) {
    jsonResponse(response, 401, { error: "Authentication required", authRequired: true });
    return;
  }

  if (await handleCoachApi(request, response, pathname)) {
    return;
  }

  if (request.method === "GET" && pathname === "/api/data") {
    jsonResponse(response, 200, readAllData());
    return;
  }

  if (request.method === "GET" && pathname === "/api/tts/status") {
    jsonResponse(response, 200, getTtsStatus());
    return;
  }

  if (request.method === "POST" && pathname === "/api/tts") {
    jsonResponse(response, 200, await createTtsAudio(await readBody(request)));
    return;
  }

  const ttsAudioMatch = pathname.match(/^\/api\/tts\/audio\/([^/]+)$/);

  if (request.method === "GET" && ttsAudioMatch) {
    if (!streamTtsAudio(ttsAudioMatch[1], response)) {
      jsonResponse(response, 404, { error: "Audio not found" });
    }
    return;
  }

  if (request.method === "POST" && pathname === "/api/import") {
    writeAllData(await readBody(request));
    jsonResponse(response, 200, readAllData());
    return;
  }

  const collectionMatch = pathname.match(/^\/api\/(exercises|plans|sessions)$/);

  if (request.method === "PUT" && collectionMatch) {
    writeCollection(collectionMatch[1], await readBody(request));
    jsonResponse(response, 200, readCollection(collectionMatch[1]));
    return;
  }

  if (request.method === "PUT" && pathname === "/api/settings") {
    writeSettings(await readBody(request));
    jsonResponse(response, 200, readSettings());
    return;
  }

  if (request.method === "PUT" && pathname === "/api/profile") {
    writeProfile(await readBody(request));
    jsonResponse(response, 200, readProfile());
    return;
  }

  jsonResponse(response, 404, { error: "Not found" });
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
};

function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicDir, `.${decodeURIComponent(requestedPath)}`);

  if (!filePath.startsWith(`${publicDir}${sep}`) && filePath !== publicDir) {
    jsonResponse(response, 403, { error: "Forbidden" });
    return;
  }

  const fallbackPath = join(publicDir, "index.html");
  const resolvedPath = existsSync(filePath) && statSync(filePath).isFile() ? filePath : fallbackPath;

  if (!existsSync(resolvedPath)) {
    jsonResponse(response, 404, { error: "Build output not found. Run npm run build first." });
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(resolvedPath)] ?? "application/octet-stream",
  });
  createReadStream(resolvedPath).pipe(response);
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
      return;
    }

    serveStatic(response, url.pathname);
  } catch (error) {
    jsonResponse(response, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Workout server listening on http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});
