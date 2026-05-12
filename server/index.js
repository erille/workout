import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { defaultExercises, defaultSettings } from "./defaultData.js";

const port = Number(process.env.PORT ?? 8060);
const publicDir = resolve(process.env.WORKOUT_PUBLIC_DIR ?? "dist");
const dbPath = resolve(process.env.WORKOUT_DB_PATH ?? join("data", "workout.sqlite"));
const allowedTables = new Set(["exercises", "plans", "sessions"]);

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
`);

function jsonResponse(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function emptyResponse(response, statusCode = 204) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  });
  response.end();
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

function readSettings() {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();

  return {
    ...defaultSettings,
    ...(row ? JSON.parse(row.data) : {}),
  };
}

function writeSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Settings payload must be an object.");
  }

  db.prepare(
    `INSERT INTO settings (id, data, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify({ ...defaultSettings, ...settings }), new Date().toISOString());
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
}

function readAllData() {
  seedDefaults();

  return {
    exercises: readCollection("exercises"),
    plans: readCollection("plans"),
    sessions: readCollection("sessions"),
    settings: readSettings(),
  };
}

function writeAllData(data) {
  writeCollection("exercises", data.exercises ?? []);
  writeCollection("plans", data.plans ?? []);
  writeCollection("sessions", data.sessions ?? []);
  writeSettings(data.settings ?? defaultSettings);
}

async function handleApi(request, response, pathname) {
  if (request.method === "OPTIONS") {
    emptyResponse(response);
    return;
  }

  if (request.method === "GET" && pathname === "/api/health") {
    jsonResponse(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && pathname === "/api/data") {
    jsonResponse(response, 200, readAllData());
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
