import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import argon2 from "argon2";
import { defaultExercises, defaultProfile, defaultSettings } from "./defaultData.js";

function createLegacyDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE plans (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const timestamp = "2026-01-02T12:00:00.000Z";
  const ownerExercise = {
    ...defaultExercises[0],
    id: "owner-existing-exercise",
    name: "Owner existing exercise",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const ownerSession = {
    id: "owner-existing-session",
    workoutName: "Owner history",
    startedAt: timestamp,
    completedAt: "2026-01-02T12:30:00.000Z",
    completed: true,
    feedback: "great",
    roundsCompleted: 1,
    steps: [],
  };
  const ownerProfile = {
    ...defaultProfile,
    name: "Ketah existing profile",
    updatedAt: timestamp,
  };

  db.prepare("INSERT INTO exercises (id, data, updated_at) VALUES (?, ?, ?)").run(
    ownerExercise.id,
    JSON.stringify(ownerExercise),
    timestamp,
  );
  db.prepare("INSERT INTO sessions (id, data, updated_at) VALUES (?, ?, ?)").run(
    ownerSession.id,
    JSON.stringify(ownerSession),
    ownerSession.completedAt,
  );
  db.prepare("INSERT INTO settings (id, data, updated_at) VALUES (1, ?, ?)").run(
    JSON.stringify(defaultSettings),
    timestamp,
  );
  db.prepare("INSERT INTO profile (id, data, updated_at) VALUES (1, ?, ?)").run(
    JSON.stringify(ownerProfile),
    timestamp,
  );
  db.close();
}

async function availablePort() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Workout server exited early with code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }

  throw new Error("Workout server did not start in time.");
}

async function apiRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json();

  return {
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    payload,
    status: response.status,
  };
}

test("migrates legacy owner data and isolates the partner account", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "workout-users-"));
  const dbPath = join(testDir, "workout.sqlite");
  createLegacyDatabase(dbPath);

  const [ownerPasswordHash, partnerPasswordHash, port] = await Promise.all([
    argon2.hash("owner-test-password"),
    argon2.hash("partner-test-password"),
    availablePort(),
  ]);
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      WORKOUT_AUTH_SECRET: "integration-test-auth-secret",
      WORKOUT_DB_PATH: dbPath,
      WORKOUT_OWNER_LOGIN: "ketah",
      WORKOUT_PASSWORD_HASH: ownerPasswordHash,
      WORKOUT_PARTNER_LOGIN: "Jee",
      WORKOUT_PARTNER_PASSWORD_HASH: partnerPasswordHash,
      WORKOUT_PUBLIC_DIR: testDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl, child);

    const ownerLogin = await apiRequest(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { login: "KETAH", password: "owner-test-password" },
    });
    assert.equal(ownerLogin.status, 200);
    assert.equal(ownerLogin.payload.user.login, "ketah");
    assert.ok(ownerLogin.cookie);

    const partnerLogin = await apiRequest(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { login: "jee", password: "partner-test-password" },
    });
    assert.equal(partnerLogin.status, 200);
    assert.equal(partnerLogin.payload.user.login, "Jee");
    assert.ok(partnerLogin.cookie);

    const ownerData = await apiRequest(baseUrl, "/api/data", {
      cookie: ownerLogin.cookie,
    });
    assert.equal(ownerData.payload.profile.name, "Ketah existing profile");
    assert.deepEqual(
      ownerData.payload.exercises.map((exercise) => exercise.id),
      ["owner-existing-exercise"],
    );
    assert.deepEqual(
      ownerData.payload.sessions.map((session) => session.id),
      ["owner-existing-session"],
    );

    const partnerData = await apiRequest(baseUrl, "/api/data", {
      cookie: partnerLogin.cookie,
    });
    assert.equal(partnerData.payload.profile.name, "");
    assert.equal(partnerData.payload.exercises.length, defaultExercises.length);
    assert.deepEqual(partnerData.payload.sessions, []);

    const partnerProfile = {
      ...partnerData.payload.profile,
      name: "Jee profile",
      updatedAt: "2026-02-01T10:00:00.000Z",
    };
    const partnerPlan = {
      id: "shared-id-is-valid-per-user",
      name: "Jee build",
      rounds: 1,
      steps: [],
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
    };
    const partnerSession = {
      id: "partner-session",
      workoutName: "Jee history",
      startedAt: "2026-02-01T10:00:00.000Z",
      completedAt: "2026-02-01T10:30:00.000Z",
      completed: true,
      feedback: "ok",
      roundsCompleted: 1,
      steps: [],
    };

    assert.equal(
      (
        await apiRequest(baseUrl, "/api/profile", {
          cookie: partnerLogin.cookie,
          method: "PUT",
          body: partnerProfile,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await apiRequest(baseUrl, "/api/plans", {
          cookie: partnerLogin.cookie,
          method: "PUT",
          body: [partnerPlan],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await apiRequest(baseUrl, "/api/sessions", {
          cookie: partnerLogin.cookie,
          method: "PUT",
          body: [partnerSession],
        })
      ).status,
      200,
    );

    const ownerDataAfterPartnerWrites = await apiRequest(baseUrl, "/api/data", {
      cookie: ownerLogin.cookie,
    });
    assert.equal(ownerDataAfterPartnerWrites.payload.profile.name, "Ketah existing profile");
    assert.deepEqual(ownerDataAfterPartnerWrites.payload.plans, []);
    assert.deepEqual(
      ownerDataAfterPartnerWrites.payload.sessions.map((session) => session.id),
      ["owner-existing-session"],
    );

    const partnerDataAfterWrites = await apiRequest(baseUrl, "/api/data", {
      cookie: partnerLogin.cookie,
    });
    assert.equal(partnerDataAfterWrites.payload.profile.name, "Jee profile");
    assert.deepEqual(
      partnerDataAfterWrites.payload.plans.map((plan) => plan.id),
      ["shared-id-is-valid-per-user"],
    );
    assert.deepEqual(
      partnerDataAfterWrites.payload.sessions.map((session) => session.id),
      ["partner-session"],
    );

    const backupFiles = readdirSync(testDir).filter((fileName) =>
      fileName.startsWith("workout.pre-users."),
    );
    assert.equal(backupFiles.length, 1);
    assert.ok(existsSync(join(testDir, backupFiles[0])));
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\n${serverOutput}`);
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) {
      await once(child, "exit");
    }
    rmSync(testDir, { force: true, recursive: true });
  }
});
