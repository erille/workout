const timestamp = "2026-01-01T00:00:00.000Z";

const defaultExerciseSeeds = [
  {
    id: "exercise-push-up",
    name: "Push-up",
    category: "push",
    defaultMode: "reps",
    defaultReps: 15,
    notes: "Keep a rigid plank line.",
  },
  {
    id: "exercise-bench-press",
    name: "Bench Press",
    category: "push",
    defaultMode: "reps",
    defaultReps: 10,
    notes: "Control the eccentric.",
  },
  { id: "exercise-squat", name: "Squat", category: "legs", defaultMode: "reps", defaultReps: 12 },
  { id: "exercise-deadlift", name: "Deadlift", category: "pull", defaultMode: "reps", defaultReps: 8 },
  { id: "exercise-pull-up", name: "Pull-up", category: "pull", defaultMode: "reps", defaultReps: 8 },
  {
    id: "exercise-burpees",
    name: "Burpees",
    category: "full_body",
    defaultMode: "time",
    defaultDurationSeconds: 45,
  },
  {
    id: "exercise-dead-bug",
    name: "Dead Bug",
    category: "core",
    defaultMode: "time",
    defaultDurationSeconds: 40,
  },
  {
    id: "exercise-plank",
    name: "Plank",
    category: "core",
    defaultMode: "time",
    defaultDurationSeconds: 45,
  },
  { id: "exercise-lunges", name: "Lunges", category: "legs", defaultMode: "reps", defaultReps: 16 },
  {
    id: "exercise-shoulder-press",
    name: "Shoulder Press",
    category: "push",
    defaultMode: "reps",
    defaultReps: 10,
  },
  { id: "exercise-row", name: "Row", category: "pull", defaultMode: "reps", defaultReps: 12 },
  { id: "exercise-sit-up", name: "Sit-up", category: "core", defaultMode: "reps", defaultReps: 20 },
  {
    id: "exercise-mountain-climbers",
    name: "Mountain Climbers",
    category: "cardio",
    defaultMode: "time",
    defaultDurationSeconds: 40,
  },
  {
    id: "exercise-jumping-jacks",
    name: "Jumping Jacks",
    category: "cardio",
    defaultMode: "time",
    defaultDurationSeconds: 45,
  },
  {
    id: "exercise-kettlebell-swing",
    name: "Kettlebell Swing",
    category: "full_body",
    defaultMode: "time",
    defaultDurationSeconds: 45,
  },
  {
    id: "exercise-glute-bridge",
    name: "Glute Bridge",
    category: "legs",
    defaultMode: "reps",
    defaultReps: 15,
  },
  {
    id: "exercise-romanian-deadlift",
    name: "Romanian Deadlift",
    category: "legs",
    defaultMode: "reps",
    defaultReps: 10,
  },
  {
    id: "exercise-bicep-curl",
    name: "Bicep Curl",
    category: "pull",
    defaultMode: "reps",
    defaultReps: 12,
  },
  {
    id: "exercise-tricep-extension",
    name: "Tricep Extension",
    category: "push",
    defaultMode: "reps",
    defaultReps: 12,
  },
  {
    id: "exercise-side-plank",
    name: "Side Plank",
    category: "core",
    defaultMode: "time",
    defaultDurationSeconds: 30,
  },
];

export const defaultExercises = defaultExerciseSeeds.map((exercise) => ({
  ...exercise,
  createdAt: timestamp,
  updatedAt: timestamp,
}));

export const defaultSettings = {
  voiceEnabled: true,
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  language: "en",
  theme: "dark",
};

export const defaultProfile = {
  name: "",
  selectedAvatarId: "avatar-01.png",
  avatar: {
    skinColor: "#d7a06f",
    hairColor: "#3b2417",
    eyeColor: "#22d3ee",
    shirtColor: "#0891b2",
    pantsColor: "#334155",
    headShape: "square",
    bodyType: "regular",
  },
  measurements: [],
  updatedAt: timestamp,
};
