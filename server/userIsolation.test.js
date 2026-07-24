import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
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

async function streamingApiRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "POST",
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body),
  });
  const raw = await response.text();

  return {
    events: raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line)),
    status: response.status,
  };
}

async function startMockOpenRouter() {
  const requests = [];
  const server = createHttpServer((request, response) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", async () => {
      const payload = JSON.parse(raw);
      requests.push({ headers: request.headers, payload });
      const lastUserMessage = [...payload.messages]
        .reverse()
        .find((message) => message.role === "user")?.content;
      const sseEvents =
        lastUserMessage === "Crée mon programme streamé"
          ? [
              ": OPENROUTER PROCESSING\r\n\r\n",
              `data: ${JSON.stringify({
                choices: [{ delta: { content: "Je prépare le programme." } }],
              })}\r\n\r\n`,
              `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          id: "call-stream-build",
                          type: "function",
                          function: {
                            name: "create_",
                            arguments:
                              '{"name":"Flux Jee","rounds":2,"steps":[{"exerciseId":"exercise-push-up",',
                          },
                        },
                      ],
                    },
                  },
                ],
              })}\r\n\r\n`,
              `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          function: {
                            name: "build",
                            arguments:
                              '"type":"reps","reps":12,"breakSeconds":30}]}',
                          },
                        },
                      ],
                    },
                  },
                ],
              })}\r\n\r\n`,
              "data: [DONE]\r\n\r\n",
            ]
          : [
              ": OPENROUTER PROCESSING\r\n\r\n",
              `data: ${JSON.stringify({
                choices: [{ delta: { content: "Bonjour " } }],
              })}\r\n\r\n`,
              `data: ${JSON.stringify({
                choices: [{ delta: { content: "Jee" } }],
              })}\r\n\r\n`,
              "data: [DONE]\r\n\r\n",
            ];

      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });

      for (const event of sseEvents) {
        const splitAt = Math.max(1, Math.floor(event.length / 2));
        response.write(event.slice(0, splitAt));
        await new Promise((resolveWait) => setTimeout(resolveWait, 2));
        response.write(event.slice(splitAt));
      }

      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  return {
    requests,
    server,
    url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`,
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

test("streams OpenRouter text and rebuilds fragmented tool calls for the signed-in user", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "workout-openrouter-stream-"));
  const dbPath = join(testDir, "workout.sqlite");
  const mockOpenRouter = await startMockOpenRouter();
  const [ownerPasswordHash, partnerPasswordHash, port] = await Promise.all([
    argon2.hash("owner-stream-password"),
    argon2.hash("partner-stream-password"),
    availablePort(),
  ]);
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      WORKOUT_AUTH_SECRET: "stream-integration-test-auth-secret",
      WORKOUT_DB_PATH: dbPath,
      WORKOUT_OWNER_LOGIN: "ketah",
      WORKOUT_OWNER_PASSWORD_HASH: ownerPasswordHash,
      WORKOUT_PARTNER_LOGIN: "Jee",
      WORKOUT_PARTNER_PASSWORD_HASH: partnerPasswordHash,
      WORKOUT_PUBLIC_DIR: testDir,
      COACH_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "test-openrouter-key",
      OPENROUTER_MODEL: "test/stream-model",
      OPENROUTER_API_URL: `${mockOpenRouter.url}/api/v1/chat/completions`,
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

    const partnerLogin = await apiRequest(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { login: "jee", password: "partner-stream-password" },
    });
    assert.equal(partnerLogin.status, 200);
    const initialPartnerData = await apiRequest(baseUrl, "/api/data", {
      cookie: partnerLogin.cookie,
    });
    assert.equal(initialPartnerData.payload.exercises.length, defaultExercises.length);

    const textStream = await streamingApiRequest(baseUrl, "/api/coach/chat/stream", {
      cookie: partnerLogin.cookie,
      body: { language: "fr", message: "Dis-moi bonjour" },
    });
    assert.equal(textStream.status, 200);
    assert.deepEqual(
      textStream.events
        .filter((event) => event.type === "delta")
        .map((event) => event.content),
      ["Bonjour ", "Jee"],
    );
    const textComplete = textStream.events.find((event) => event.type === "complete");
    assert.ok(textComplete);
    assert.equal(textComplete.message, "Bonjour Jee");
    assert.equal(textComplete.messages.at(-1).content, "Bonjour Jee");

    const buildStream = await streamingApiRequest(baseUrl, "/api/coach/chat/stream", {
      cookie: partnerLogin.cookie,
      body: { language: "fr", message: "Crée mon programme streamé" },
    });
    assert.equal(buildStream.status, 200);
    assert.deepEqual(
      buildStream.events.slice(0, 2).map((event) => event.type),
      ["delta", "reset"],
    );
    const buildComplete = buildStream.events.find((event) => event.type === "complete");
    assert.ok(buildComplete);
    assert.equal(buildComplete.dataChanged, true);
    assert.match(buildComplete.message, /J'ai créé la séance "Flux Jee"/);

    const [partnerData, ownerLogin] = await Promise.all([
      apiRequest(baseUrl, "/api/data", { cookie: partnerLogin.cookie }),
      apiRequest(baseUrl, "/api/auth/login", {
        method: "POST",
        body: { login: "ketah", password: "owner-stream-password" },
      }),
    ]);
    assert.deepEqual(
      partnerData.payload.plans.map((plan) => plan.name),
      ["Flux Jee"],
    );
    assert.equal(partnerData.payload.plans[0].steps[0].reps, 12);

    const ownerData = await apiRequest(baseUrl, "/api/data", {
      cookie: ownerLogin.cookie,
    });
    assert.deepEqual(ownerData.payload.plans, []);

    const savedMessages = await apiRequest(baseUrl, "/api/coach/messages", {
      cookie: partnerLogin.cookie,
    });
    assert.deepEqual(
      savedMessages.payload.messages.map((message) => message.role),
      ["user", "assistant", "user", "assistant"],
    );
    assert.equal(mockOpenRouter.requests.length, 2);
    assert.ok(mockOpenRouter.requests.every(({ payload }) => payload.stream === true));
    assert.ok(
      mockOpenRouter.requests.every(
        ({ headers }) => headers.authorization === "Bearer test-openrouter-key",
      ),
    );
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\n${serverOutput}`);
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) {
      await once(child, "exit");
    }
    mockOpenRouter.server.close();
    await once(mockOpenRouter.server, "close");
    rmSync(testDir, { force: true, recursive: true });
  }
});
