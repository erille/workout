import { Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  exerciseCategories,
  exerciseCategoryLabels,
  type Exercise,
  type ExerciseCategory,
  type ExerciseMode,
} from "../../models/exercise";
import { createId } from "../../utils/id";

type ExerciseLibraryProps = {
  exercises: Exercise[];
  onSaveExercise: (exercise: Exercise) => Promise<void>;
  onDeleteExercise: (exerciseId: string) => Promise<void>;
};

type ExerciseFormState = {
  id?: string;
  name: string;
  category: ExerciseCategory;
  defaultMode: ExerciseMode;
  defaultDurationSeconds: number;
  defaultReps: number;
  notes: string;
  createdAt?: string;
};

const emptyForm: ExerciseFormState = {
  name: "",
  category: "push",
  defaultMode: "reps",
  defaultDurationSeconds: 45,
  defaultReps: 12,
  notes: "",
};

function toFormState(exercise: Exercise): ExerciseFormState {
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    defaultMode: exercise.defaultMode,
    defaultDurationSeconds: exercise.defaultDurationSeconds ?? 45,
    defaultReps: exercise.defaultReps ?? 12,
    notes: exercise.notes ?? "",
    createdAt: exercise.createdAt,
  };
}

export function ExerciseLibrary({
  exercises,
  onDeleteExercise,
  onSaveExercise,
}: ExerciseLibraryProps) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ExerciseFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      return (
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        exercise.category.toLowerCase().includes(normalizedQuery) ||
        exercise.defaultMode.includes(normalizedQuery)
      );
    });
  }, [exercises, query]);

  const resetForm = () => {
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setError("Exercise name is required.");
      return;
    }

    const duplicate = exercises.find(
      (exercise) =>
        exercise.name.toLowerCase() === trimmedName.toLowerCase() && exercise.id !== form.id,
    );

    if (duplicate) {
      setError("Exercise names must be unique.");
      return;
    }

    if (form.defaultMode === "time" && form.defaultDurationSeconds <= 0) {
      setError("Default duration must be greater than 0.");
      return;
    }

    if (form.defaultMode === "reps" && form.defaultReps <= 0) {
      setError("Default reps must be greater than 0.");
      return;
    }

    setIsSaving(true);

    const now = new Date().toISOString();
    const exercise: Exercise = {
      id: form.id ?? createId("exercise"),
      name: trimmedName,
      category: form.category,
      defaultMode: form.defaultMode,
      defaultDurationSeconds:
        form.defaultMode === "time" ? Math.max(1, Math.round(form.defaultDurationSeconds)) : undefined,
      defaultReps:
        form.defaultMode === "reps" ? Math.max(1, Math.round(form.defaultReps)) : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };

    await onSaveExercise(exercise);
    setIsSaving(false);
    resetForm();
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Exercise Library</p>
            <h2 className="text-2xl font-bold text-slate-50">Reusable exercises</h2>
          </div>
          <label className="relative block sm:w-80">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
            />
            <input
              className="field pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exercises"
              type="search"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="panel flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-50">{exercise.name}</h3>
                  <p className="text-sm text-slate-400">
                    {exerciseCategoryLabels[exercise.category]} · {exercise.defaultMode}
                  </p>
                </div>
                <span className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300">
                  {exercise.defaultMode === "time"
                    ? `${exercise.defaultDurationSeconds ?? 0}s`
                    : `${exercise.defaultReps ?? 0} reps`}
                </span>
              </div>

              {exercise.notes ? (
                <p className="min-h-10 text-sm leading-6 text-slate-300">{exercise.notes}</p>
              ) : (
                <p className="min-h-10 text-sm leading-6 text-slate-500">No notes</p>
              )}

              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  className="secondary-button flex-1"
                  onClick={() => {
                    setForm(toFormState(exercise));
                    setError(null);
                  }}
                >
                  <Edit3 aria-hidden="true" size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  className="danger-button"
                  aria-label={`Delete ${exercise.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete ${exercise.name}?`)) {
                      void onDeleteExercise(exercise.id);
                    }
                  }}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="panel h-fit p-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label">{form.id ? "Edit Exercise" : "Add Exercise"}</p>
              <h2 className="text-xl font-bold text-slate-50">
                {form.id ? form.name || "Exercise" : "New exercise"}
              </h2>
            </div>
            {form.id ? (
              <button type="button" className="secondary-button px-3" onClick={resetForm}>
                <X aria-hidden="true" size={16} />
              </button>
            ) : null}
          </div>

          <label className="block space-y-2">
            <span className="label">Name</span>
            <input
              className="field"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Exercise name"
            />
          </label>

          <label className="block space-y-2">
            <span className="label">Category</span>
            <select
              className="field"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as ExerciseCategory,
                }))
              }
            >
              {exerciseCategories.map((category) => (
                <option key={category} value={category}>
                  {exerciseCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="label">Default mode</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["reps", "time"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                    form.defaultMode === mode
                      ? "border-cyan-300 bg-cyan-300 text-slate-950"
                      : "border-slate-700 bg-slate-950 text-slate-300"
                  }`}
                  onClick={() => setForm((current) => ({ ...current, defaultMode: mode }))}
                >
                  {mode === "time" ? "Time" : "Reps"}
                </button>
              ))}
            </div>
          </fieldset>

          {form.defaultMode === "time" ? (
            <label className="block space-y-2">
              <span className="label">Default duration</span>
              <input
                className="field"
                min={1}
                type="number"
                value={form.defaultDurationSeconds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultDurationSeconds: Number(event.target.value),
                  }))
                }
              />
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="label">Default reps</span>
              <input
                className="field"
                min={1}
                type="number"
                value={form.defaultReps}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultReps: Number(event.target.value),
                  }))
                }
              />
            </label>
          )}

          <label className="block space-y-2">
            <span className="label">Notes</span>
            <textarea
              className="field min-h-24 resize-y"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional coaching notes"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <button type="submit" className="primary-button w-full" disabled={isSaving}>
            {form.id ? <Save aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
            {form.id ? "Save changes" : "Add exercise"}
          </button>
        </form>
      </aside>
    </section>
  );
}
