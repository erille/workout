import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
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
  const savedExerciseDefaultsVersion = Number.isFinite(savedSettings.exerciseDefaultsVersion)
    ? Math.max(0, Math.round(Number(savedSettings.exerciseDefaultsVersion)))
    : 0;

  return {
    ...defaultSettings,
    ...savedSettings,
    notificationMode,
    voiceProvider,
    voiceLanguage,
    voiceEnabled: notificationMode === "voice",
    exerciseDefaultsVersion: savedExerciseDefaultsVersion,
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
  const nextExerciseDefaultsVersion = Number.isFinite(settings.exerciseDefaultsVersion)
    ? Math.max(0, Math.round(Number(settings.exerciseDefaultsVersion)))
    : defaultSettings.exerciseDefaultsVersion;

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
    exerciseDefaultsVersion: nextExerciseDefaultsVersion,
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
