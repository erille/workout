import { Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { translateExerciseName } from "../../i18n/exerciseNames";
import {
  exerciseCategories,
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
  defaultDistanceMeters: number;
  notes: string;
  createdAt?: string;
};

const emptyForm: ExerciseFormState = {
  name: "",
  category: "push",
  defaultMode: "reps",
  defaultDurationSeconds: 45,
  defaultReps: 12,
  defaultDistanceMeters: 500,
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
    defaultDistanceMeters: exercise.defaultDistanceMeters ?? 500,
    notes: exercise.notes ?? "",
    createdAt: exercise.createdAt,
  };
}

function modeLabel(mode: ExerciseMode, labels: { time: string; reps: string; distance: string }): string {
  if (mode === "time") {
    return labels.time;
  }

  return mode === "distance" ? labels.distance : labels.reps;
}

export function ExerciseLibrary({
  exercises,
  onDeleteExercise,
  onSaveExercise,
}: ExerciseLibraryProps) {
  const { language, t } = useI18n();
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
      const translatedName = translateExerciseName(exercise, language).toLowerCase();

      return (
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        translatedName.includes(normalizedQuery) ||
        exercise.category.toLowerCase().includes(normalizedQuery) ||
        exercise.defaultMode.includes(normalizedQuery)
      );
    });
  }, [exercises, language, query]);

  const resetForm = () => {
    setForm(emptyForm);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setError(t("exercises.errorNameRequired"));
      return;
    }

    const duplicate = exercises.find(
      (exercise) =>
        exercise.name.toLowerCase() === trimmedName.toLowerCase() && exercise.id !== form.id,
    );

    if (duplicate) {
      setError(t("exercises.errorUnique"));
      return;
    }

    if (form.defaultMode === "time" && form.defaultDurationSeconds <= 0) {
      setError(t("exercises.errorDuration"));
      return;
    }

    if (form.defaultMode === "reps" && form.defaultReps <= 0) {
      setError(t("exercises.errorReps"));
      return;
    }

    if (form.defaultMode === "distance" && form.defaultDistanceMeters <= 0) {
      setError(t("exercises.errorDistance"));
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
      defaultDistanceMeters:
        form.defaultMode === "distance"
          ? Math.max(1, Math.round(form.defaultDistanceMeters))
          : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };

    await onSaveExercise(exercise);
    setIsSaving(false);
    resetForm();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">{t("exercises.section")}</p>
          <h2 className="text-2xl font-bold text-slate-50">{t("exercises.title")}</h2>
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
            placeholder={t("exercises.search")}
            type="search"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="panel flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-50">
                    {translateExerciseName(exercise, language)}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {t(`category.${exercise.category}`)} -{" "}
                    {modeLabel(exercise.defaultMode, {
                      time: t("common.time"),
                      reps: t("common.reps"),
                      distance: t("common.distance"),
                    })}
                  </p>
                </div>
                <span className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300">
                  {exercise.defaultMode === "time"
                    ? `${exercise.defaultDurationSeconds ?? 0}s`
                    : exercise.defaultMode === "distance"
                      ? `${exercise.defaultDistanceMeters ?? 0} ${t("common.meters")}`
                      : `${exercise.defaultReps ?? 0} ${t("common.reps")}`}
                </span>
              </div>

              {exercise.notes ? (
                <p className="min-h-10 text-sm leading-6 text-slate-300">{exercise.notes}</p>
              ) : (
                <p className="min-h-10 text-sm leading-6 text-slate-500">{t("exercises.noNotes")}</p>
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
                  {t("common.edit")}
                </button>
                <button
                  type="button"
                  className="danger-button"
                  aria-label={t("exercises.deleteConfirm", { name: exercise.name })}
                  onClick={() => {
                    if (window.confirm(t("exercises.deleteConfirm", { name: exercise.name }))) {
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

        <aside className="panel h-fit p-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label">{form.id ? t("exercises.formEdit") : t("exercises.formAdd")}</p>
                <h2 className="text-xl font-bold text-slate-50">
                  {form.id ? form.name || t("common.exercise") : t("exercises.newExercise")}
                </h2>
              </div>
              {form.id ? (
                <button type="button" className="secondary-button px-3" onClick={resetForm}>
                  <X aria-hidden="true" size={16} />
                </button>
              ) : null}
            </div>

            <label className="block space-y-2">
              <span className="label">{t("exercises.name")}</span>
              <input
                className="field"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t("exercises.namePlaceholder")}
              />
            </label>

            <label className="block space-y-2">
              <span className="label">{t("exercises.category")}</span>
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
                    {t(`category.${category}`)}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="label">{t("exercises.defaultMode")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["reps", "time", "distance"] as const).map((mode) => (
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
                    {modeLabel(mode, {
                      time: t("common.time"),
                      reps: t("common.reps"),
                      distance: t("common.distance"),
                    })}
                  </button>
                ))}
              </div>
            </fieldset>

            {form.defaultMode === "time" ? (
              <label className="block space-y-2">
                <span className="label">{t("exercises.defaultDuration")}</span>
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
            ) : form.defaultMode === "distance" ? (
              <label className="block space-y-2">
                <span className="label">{t("exercises.defaultDistance")}</span>
                <input
                  className="field"
                  min={1}
                  type="number"
                  value={form.defaultDistanceMeters}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultDistanceMeters: Number(event.target.value),
                    }))
                  }
                />
              </label>
            ) : (
              <label className="block space-y-2">
                <span className="label">{t("exercises.defaultReps")}</span>
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
              <span className="label">{t("exercises.notes")}</span>
              <textarea
                className="field min-h-24 resize-y"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder={t("exercises.notesPlaceholder")}
              />
            </label>

            {error ? (
              <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <button type="submit" className="primary-button w-full" disabled={isSaving}>
              {form.id ? <Save aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
              {form.id ? t("exercises.saveChanges") : t("exercises.addExercise")}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
