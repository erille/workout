import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { defaultExercises, defaultProfile, defaultSettings } from "./defaultData.js";

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

function isoDaysAgo(days, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function addSeconds(isoDate, seconds) {
  return new Date(new Date(isoDate).getTime() + seconds * 1000).toISOString();
}

function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

function schema() {
  return `
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS plans (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
}

function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((entry) => entry.name === column);
}

function readCollection(db, table, userId) {
  return db
    .prepare(`SELECT data FROM ${table} WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(userId)
    .map((row) => JSON.parse(row.data));
}

function makeStep(id, exercise, config) {
  const common = {
    id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    breakSeconds: config.breakSeconds,
    weight: config.weight,
  };

  return config.type === "time"
    ? {
        ...common,
        type: "time",
        durationSeconds: config.durationSeconds,
      }
    : {
        ...common,
        type: "reps",
        reps: config.reps,
      };
}

function makePlan(id, name, rounds, steps, daysAgo) {
  const timestamp = isoDaysAgo(daysAgo, 18);

  return {
    id,
    name,
    rounds,
    steps,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function stepDuration(step) {
  const activeSeconds = step.type === "time" ? step.durationSeconds : step.reps * 4;
  return activeSeconds + step.breakSeconds;
}

function makeSession(plan, config) {
  const startedAt = isoDaysAgo(config.daysAgo, config.hour, config.minute);
  const steps = [];
  let elapsedSeconds = 0;

  for (let round = 1; round <= plan.rounds; round += 1) {
    for (const step of plan.steps) {
      const weight =
        typeof step.weight === "number"
          ? roundToHalf(Math.max(0, step.weight + config.weightDelta))
          : undefined;

      steps.push({
        id: `${config.id}-round-${round}-${step.id}`,
        exerciseId: step.exerciseId,
        exerciseName: step.exerciseName,
        type: step.type,
        durationSeconds: step.type === "time" ? step.durationSeconds : undefined,
        reps: step.type === "reps" ? step.reps : undefined,
        breakSeconds: step.breakSeconds,
        weight,
        round,
        completed: true,
      });
      elapsedSeconds += stepDuration(step);
    }
  }

  return {
    id: config.id,
    workoutPlanId: plan.id,
    workoutName: plan.name,
    startedAt,
    completedAt: addSeconds(startedAt, elapsedSeconds),
    completed: true,
    roundsCompleted: plan.rounds,
    steps,
  };
}

loadDotEnv();

const dbPath = resolve(process.env.WORKOUT_DB_PATH ?? join("data", "workout.sqlite"));
const seedUserId = process.env.WORKOUT_SEED_USER_ID?.trim() || "owner";
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(schema());

if (!["exercises", "plans", "sessions"].every((table) => hasColumn(db, table, "user_id"))) {
  throw new Error("Start the Workout server once to migrate the database before seeding demo data.");
}

const now = new Date().toISOString();
const insertExercise = db.prepare(
  "INSERT OR IGNORE INTO exercises (user_id, id, data, updated_at) VALUES (?, ?, ?, ?)",
);
const insertPlan = db.prepare(
  "INSERT INTO plans (user_id, id, data, updated_at) VALUES (?, ?, ?, ?)",
);
const insertSession = db.prepare(
  "INSERT INTO sessions (user_id, id, data, updated_at) VALUES (?, ?, ?, ?)",
);

db.exec("BEGIN IMMEDIATE");

try {
  for (const exercise of defaultExercises) {
    insertExercise.run(seedUserId, exercise.id, JSON.stringify(exercise), exercise.updatedAt ?? now);
  }

  db.prepare(
    "INSERT OR IGNORE INTO user_settings (user_id, data, updated_at) VALUES (?, ?, ?)",
  ).run(
    seedUserId,
    JSON.stringify(defaultSettings),
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO user_profiles (user_id, data, updated_at) VALUES (?, ?, ?)",
  ).run(
    seedUserId,
    JSON.stringify(defaultProfile),
    now,
  );

  db.prepare("DELETE FROM plans WHERE user_id = ? AND id LIKE 'demo-plan-%'").run(seedUserId);
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND id LIKE 'demo-session-%'").run(seedUserId);

  const exercises = new Map(
    readCollection(db, "exercises", seedUserId).map((exercise) => [exercise.id, exercise]),
  );
  const getExercise = (id) => {
    const exercise = exercises.get(id);

    if (!exercise) {
      throw new Error(`Missing exercise ${id}`);
    }

    return exercise;
  };

  const strengthPlan = makePlan(
    "demo-plan-full-body-strength-a",
    "Demo Full Body Strength A",
    3,
    [
      makeStep("demo-step-bench-press", getExercise("exercise-bench-press"), {
        type: "reps",
        reps: 10,
        breakSeconds: 60,
        weight: 42.5,
      }),
      makeStep("demo-step-row", getExercise("exercise-row"), {
        type: "reps",
        reps: 12,
        breakSeconds: 45,
        weight: 25,
      }),
      makeStep("demo-step-squat", getExercise("exercise-squat"), {
        type: "reps",
        reps: 10,
        breakSeconds: 75,
        weight: 50,
      }),
      makeStep("demo-step-plank", getExercise("exercise-plank"), {
        type: "time",
        durationSeconds: 45,
        breakSeconds: 45,
      }),
    ],
    32,
  );

  const dumbbellPlan = makePlan(
    "demo-plan-dumbbell-push-pull",
    "Demo Dumbbell Push Pull",
    4,
    [
      makeStep("demo-step-shoulder-press", getExercise("exercise-shoulder-press"), {
        type: "reps",
        reps: 10,
        breakSeconds: 45,
        weight: 14,
      }),
      makeStep("demo-step-bicep-curl", getExercise("exercise-bicep-curl"), {
        type: "reps",
        reps: 12,
        breakSeconds: 30,
        weight: 10,
      }),
      makeStep("demo-step-tricep-extension", getExercise("exercise-tricep-extension"), {
        type: "reps",
        reps: 12,
        breakSeconds: 30,
        weight: 8,
      }),
      makeStep("demo-step-dead-bug", getExercise("exercise-dead-bug"), {
        type: "time",
        durationSeconds: 40,
        breakSeconds: 35,
      }),
    ],
    28,
  );

  const conditioningPlan = makePlan(
    "demo-plan-conditioning-core",
    "Demo Conditioning Core",
    3,
    [
      makeStep("demo-step-kettlebell-swing", getExercise("exercise-kettlebell-swing"), {
        type: "time",
        durationSeconds: 45,
        breakSeconds: 35,
        weight: 16,
      }),
      makeStep("demo-step-burpees", getExercise("exercise-burpees"), {
        type: "time",
        durationSeconds: 40,
        breakSeconds: 45,
      }),
      makeStep("demo-step-mountain-climbers", getExercise("exercise-mountain-climbers"), {
        type: "time",
        durationSeconds: 45,
        breakSeconds: 35,
      }),
      makeStep("demo-step-side-plank", getExercise("exercise-side-plank"), {
        type: "time",
        durationSeconds: 30,
        breakSeconds: 30,
      }),
    ],
    24,
  );

  const plans = [strengthPlan, dumbbellPlan, conditioningPlan];
  const sessions = [
    makeSession(strengthPlan, {
      id: "demo-session-strength-001",
      daysAgo: 28,
      hour: 18,
      minute: 20,
      weightDelta: -5,
    }),
    makeSession(dumbbellPlan, {
      id: "demo-session-dumbbell-001",
      daysAgo: 24,
      hour: 7,
      minute: 15,
      weightDelta: -2,
    }),
    makeSession(conditioningPlan, {
      id: "demo-session-conditioning-001",
      daysAgo: 21,
      hour: 18,
      minute: 5,
      weightDelta: -1.5,
    }),
    makeSession(strengthPlan, {
      id: "demo-session-strength-002",
      daysAgo: 18,
      hour: 18,
      minute: 10,
      weightDelta: -2.5,
    }),
    makeSession(dumbbellPlan, {
      id: "demo-session-dumbbell-002",
      daysAgo: 15,
      hour: 7,
      minute: 30,
      weightDelta: -1,
    }),
    makeSession(conditioningPlan, {
      id: "demo-session-conditioning-002",
      daysAgo: 12,
      hour: 18,
      minute: 35,
      weightDelta: 0,
    }),
    makeSession(strengthPlan, {
      id: "demo-session-strength-003",
      daysAgo: 9,
      hour: 18,
      minute: 15,
      weightDelta: 0,
    }),
    makeSession(dumbbellPlan, {
      id: "demo-session-dumbbell-003",
      daysAgo: 7,
      hour: 8,
      minute: 0,
      weightDelta: 0.5,
    }),
    makeSession(conditioningPlan, {
      id: "demo-session-conditioning-003",
      daysAgo: 5,
      hour: 18,
      minute: 45,
      weightDelta: 1,
    }),
    makeSession(strengthPlan, {
      id: "demo-session-strength-004",
      daysAgo: 3,
      hour: 18,
      minute: 20,
      weightDelta: 2.5,
    }),
    makeSession(dumbbellPlan, {
      id: "demo-session-dumbbell-004",
      daysAgo: 1,
      hour: 7,
      minute: 20,
      weightDelta: 1,
    }),
  ];

  for (const plan of plans) {
    insertPlan.run(seedUserId, plan.id, JSON.stringify(plan), plan.updatedAt);
  }

  for (const session of sessions) {
    insertSession.run(seedUserId, session.id, JSON.stringify(session), session.completedAt);
  }

  db.exec("COMMIT");

  console.log(`Seeded ${plans.length} demo plans and ${sessions.length} demo sessions.`);
  console.log(`User: ${seedUserId}`);
  console.log(`SQLite database: ${dbPath}`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
