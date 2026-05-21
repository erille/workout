import { Edit3, Plus, Save, Search, Tags, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { Language, TranslationKey } from "../../i18n/translations";
import { translateExerciseName } from "../../i18n/exerciseNames";
import {
  createExerciseCategoryDefinition,
  type Exercise,
  type ExerciseCategory,
  type ExerciseCategoryDefinition,
  type ExerciseMode,
  isDefaultExerciseCategory,
  normalizeCategoryInput,
  normalizeExerciseCategoryDefinitions,
} from "../../models/exercise";
import { createId } from "../../utils/id";

type ExerciseLibraryProps = {
  categories: ExerciseCategoryDefinition[];
  exercises: Exercise[];
  onSaveExercise: (exercise: Exercise) => Promise<void>;
  onSaveExercises: (exercises: Exercise[]) => Promise<void>;
  onSaveCategories: (categories: ExerciseCategoryDefinition[]) => Promise<void>;
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

type FormPlacement = "add-popover" | "edit-dialog";

type CategoryDeleteRequest = {
  category: string;
  replacementCategory: string;
};

const emptyForm: ExerciseFormState = {
  name: "",
  category: "push",
  defaultMode: "reps",
  defaultDurationSeconds: 45,
  defaultReps: 20,
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
    defaultReps: exercise.defaultReps ?? 20,
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

function normalizedCategoryKey(value: string): string {
  return normalizeCategoryInput(value).toLowerCase();
}

function categoryLabel(
  category: ExerciseCategoryDefinition,
  language: Language,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const localizedLabel = category.labels[language];

  if (localizedLabel) {
    return localizedLabel;
  }

  if (isDefaultExerciseCategory(category.id)) {
    return t(`category.${category.id}` as TranslationKey);
  }

  return category.labels.fr ?? category.labels.en ?? category.id;
}

export function ExerciseLibrary({
  categories,
  exercises,
  onDeleteExercise,
  onSaveCategories,
  onSaveExercise,
  onSaveExercises,
}: ExerciseLibraryProps) {
  const { language, t } = useI18n();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ExerciseFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [categoryToAdd, setCategoryToAdd] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<CategoryDeleteRequest | null>(null);
  const [formPlacement, setFormPlacement] = useState<FormPlacement>("add-popover");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCategories, setIsSavingCategories] = useState(false);
  const formPopoverRef = useRef<HTMLDivElement>(null);

  const visibleCategories = useMemo(() => {
    const configuredCategories = normalizeExerciseCategoryDefinitions(categories, language);
    const configuredCategoryIds = new Set(configuredCategories.map((category) => category.id));
    const exerciseOnlyCategories = exercises
      .filter((exercise) => !configuredCategoryIds.has(exercise.category))
      .map((exercise) => ({
        id: exercise.category,
        labels: { [language]: exercise.category },
      }));

    return normalizeExerciseCategoryDefinitions(
      [...configuredCategories, ...exerciseOnlyCategories],
      language,
    );
  }, [categories, exercises, language]);

  const categoryLabelsById = useMemo(() => {
    return new Map(
      visibleCategories.map((category) => [
        category.id,
        categoryLabel(category, language, t),
      ]),
    );
  }, [language, t, visibleCategories]);

  const sortedCategoryOptions = useMemo(() => {
    const locale = language === "fr" ? "fr" : "en";

    return [...visibleCategories].sort((firstCategory, secondCategory) =>
      categoryLabel(firstCategory, language, t).localeCompare(
        categoryLabel(secondCategory, language, t),
        locale,
        { sensitivity: "base" },
      ),
    );
  }, [language, t, visibleCategories]);

  const getCategoryLabel = (categoryId: string) => categoryLabelsById.get(categoryId) ?? categoryId;

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return exercises;
    }

    return exercises.filter((exercise) => {
      const translatedName = translateExerciseName(exercise, language).toLowerCase();
      const translatedCategory = getCategoryLabel(exercise.category).toLowerCase();

      return (
        exercise.name.toLowerCase().includes(normalizedQuery) ||
        translatedName.includes(normalizedQuery) ||
        exercise.category.toLowerCase().includes(normalizedQuery) ||
        translatedCategory.includes(normalizedQuery) ||
        exercise.defaultMode.includes(normalizedQuery)
      );
    });
  }, [categoryLabelsById, exercises, language, query]);

  useEffect(() => {
    setCategoryDrafts(
      Object.fromEntries(
        visibleCategories.map((category) => [
          category.id,
          categoryLabel(category, language, t),
        ]),
      ),
    );
  }, [language, t, visibleCategories]);

  useEffect(() => {
    if (visibleCategories.some((category) => category.id === form.category)) {
      return;
    }

    setForm((current) => ({
      ...current,
      category: visibleCategories[0]?.id ?? "other",
    }));
  }, [form.category, visibleCategories]);

  const resetForm = () => {
    setForm(emptyForm);
    setError(null);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const openAddForm = () => {
    resetForm();
    setFormPlacement("add-popover");
    setIsFormOpen(true);
  };

  const openEditForm = (exercise: Exercise) => {
    setForm(toFormState(exercise));
    setError(null);
    setFormPlacement("edit-dialog");
    setIsFormOpen(true);
  };

  const categoryNameExists = (name: string, ignoredCategoryId?: string) => {
    const normalizedName = normalizedCategoryKey(name);

    return visibleCategories.some((category) => {
      if (category.id === ignoredCategoryId) {
        return false;
      }

      const labelsToCheck = [
        category.id,
        category.labels.en ?? "",
        category.labels.fr ?? "",
        categoryLabel(category, language, t),
      ];

      return labelsToCheck.some((label) => normalizedCategoryKey(label) === normalizedName);
    });
  };

  const saveCategoryChanges = async (
    nextCategories: ExerciseCategoryDefinition[],
    nextExercises = exercises,
  ): Promise<boolean> => {
    const normalizedCategories = normalizeExerciseCategoryDefinitions(nextCategories, language);

    setCategoryError(null);
    setCategoryMessage(null);
    setIsSavingCategories(true);

    try {
      if (nextExercises !== exercises) {
        await onSaveExercises(nextExercises);
      }

      await onSaveCategories(normalizedCategories);
      setCategoryDrafts(
        Object.fromEntries(
          normalizedCategories.map((category) => [
            category.id,
            categoryLabel(category, language, t),
          ]),
        ),
      );
      setCategoryMessage(t("exercises.categorySaved"));
      return true;
    } catch {
      setCategoryError(t("exercises.categorySaveError"));
      return false;
    } finally {
      setIsSavingCategories(false);
    }
  };

  const addCategory = async () => {
    const categoryName = normalizeCategoryInput(categoryToAdd);

    if (!categoryName) {
      setCategoryError(t("exercises.categoryErrorName"));
      return;
    }

    if (categoryNameExists(categoryName)) {
      setCategoryError(t("exercises.categoryErrorDuplicate"));
      return;
    }

    const nextCategory = createExerciseCategoryDefinition(categoryName, language);

    if (await saveCategoryChanges([...visibleCategories, nextCategory])) {
      setCategoryToAdd("");
      setForm((current) => ({ ...current, category: nextCategory.id }));
    }
  };

  const renameCategory = async (category: ExerciseCategoryDefinition) => {
    const nextCategoryName = normalizeCategoryInput(categoryDrafts[category.id] ?? "");

    if (!nextCategoryName) {
      setCategoryError(t("exercises.categoryErrorName"));
      return;
    }

    if (
      normalizedCategoryKey(nextCategoryName) ===
      normalizedCategoryKey(categoryLabel(category, language, t))
    ) {
      setCategoryDrafts((current) => ({
        ...current,
        [category.id]: categoryLabel(category, language, t),
      }));
      return;
    }

    if (categoryNameExists(nextCategoryName, category.id)) {
      setCategoryError(t("exercises.categoryErrorDuplicate"));
      return;
    }

    const nextCategories = visibleCategories.map((item) =>
      item.id === category.id
        ? {
            ...item,
            labels: {
              ...item.labels,
              [language]: nextCategoryName,
            },
          }
        : item,
    );

    await saveCategoryChanges(nextCategories);
  };

  const requestDeleteCategory = (category: string) => {
    if (visibleCategories.length <= 1) {
      setCategoryError(t("exercises.categoryErrorLast"));
      return;
    }

    const replacementCategory =
      visibleCategories.find((item) => item.id !== category)?.id ?? "";
    const usageCount = exercises.filter((exercise) => exercise.category === category).length;

    setCategoryError(null);
    setCategoryMessage(null);

    if (usageCount === 0) {
      void saveCategoryChanges(visibleCategories.filter((item) => item.id !== category));
      return;
    }

    setDeleteRequest({ category, replacementCategory });
  };

  const confirmDeleteCategory = async () => {
    if (!deleteRequest || !deleteRequest.replacementCategory) {
      return;
    }

    const now = new Date().toISOString();
    const nextCategories = visibleCategories.filter(
      (category) => category.id !== deleteRequest.category,
    );
    const nextExercises = exercises.map((exercise) =>
      exercise.category === deleteRequest.category
        ? { ...exercise, category: deleteRequest.replacementCategory, updatedAt: now }
        : exercise,
    );

    if (await saveCategoryChanges(nextCategories, nextExercises)) {
      setForm((current) => ({
        ...current,
        category:
          current.category === deleteRequest.category
            ? deleteRequest.replacementCategory
            : current.category,
      }));
      setDeleteRequest(null);
    }
  };

  useEffect(() => {
    if (!isFormOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (formPlacement === "edit-dialog") {
        return;
      }

      if (!formPopoverRef.current?.contains(event.target as Node)) {
        closeForm();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeForm();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [formPlacement, isFormOpen]);

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

    try {
      await onSaveExercise(exercise);
      resetForm();
      setIsFormOpen(false);
    } catch {
      setError(t("exercises.errorSave"));
    } finally {
      setIsSaving(false);
    }
  };

  const exerciseForm = (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label">{form.id ? t("exercises.formEdit") : t("exercises.formAdd")}</p>
          <h2 className="text-xl font-bold text-slate-50">
            {form.id ? form.name || t("common.exercise") : t("exercises.newExercise")}
          </h2>
        </div>
        <button type="button" className="secondary-button px-3" onClick={closeForm}>
          <X aria-hidden="true" size={16} />
        </button>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="label">{t("exercises.category")}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-cyan-200 hover:text-cyan-100"
            onClick={() => setIsCategoryManagerOpen(true)}
          >
            <Tags aria-hidden="true" size={14} />
            {t("exercises.manageCategories")}
          </button>
        </div>
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
          {sortedCategoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryLabel(category, language, t)}
            </option>
          ))}
        </select>
      </div>

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
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">{t("exercises.section")}</p>
          <h2 className="text-2xl font-bold text-slate-50">{t("exercises.title")}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          <button
            type="button"
            className="secondary-button w-full sm:w-auto"
            onClick={() => setIsCategoryManagerOpen(true)}
          >
            <Tags aria-hidden="true" size={17} />
            {t("exercises.manageCategories")}
          </button>
          <div ref={formPopoverRef} className="relative">
            <button type="button" className="primary-button w-full sm:w-auto" onClick={openAddForm}>
              <Plus aria-hidden="true" size={17} />
              {t("exercises.addExercise")}
            </button>
            {isFormOpen && formPlacement === "add-popover" ? (
              <div className="fixed inset-x-4 top-24 z-30 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
                <span className="absolute -top-1 right-8 hidden h-2 w-2 rotate-45 border-l border-t border-slate-700 bg-slate-900 sm:block" />
                {exerciseForm}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isFormOpen && formPlacement === "edit-dialog" ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            {exerciseForm}
          </div>
        </div>
      ) : null}

      {isCategoryManagerOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label">{t("exercises.categories")}</p>
                <h3 className="text-xl font-bold text-slate-50">
                  {t("exercises.categoryManagerTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {t("exercises.categoryManagerDescription")}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button px-3"
                aria-label={t("common.cancel")}
                onClick={() => {
                  setIsCategoryManagerOpen(false);
                  setDeleteRequest(null);
                  setCategoryError(null);
                  setCategoryMessage(null);
                }}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <form
              className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void addCategory();
              }}
            >
              <label className="space-y-2">
                <span className="label">{t("exercises.newCategory")}</span>
                <input
                  className="field"
                  value={categoryToAdd}
                  onChange={(event) => {
                    setCategoryToAdd(event.target.value);
                    setCategoryError(null);
                    setCategoryMessage(null);
                  }}
                  placeholder={t("exercises.categoryNamePlaceholder")}
                />
              </label>
              <button
                type="submit"
                className="primary-button self-end"
                disabled={isSavingCategories}
              >
                <Plus aria-hidden="true" size={17} />
                {t("exercises.addCategory")}
              </button>
            </form>

            {deleteRequest ? (
              <div className="mt-4 rounded-md border border-amber-300/50 bg-amber-300/10 p-3">
                <p className="font-semibold text-amber-100">
                  {t("exercises.categoryDeleteTitle", {
                    category: getCategoryLabel(deleteRequest.category),
                  })}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {t("exercises.categoryDeleteDescription", {
                    count: exercises.filter((exercise) => exercise.category === deleteRequest.category).length,
                  })}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                  <label className="space-y-2">
                    <span className="label">{t("exercises.moveExercisesTo")}</span>
                    <select
                      className="field"
                      value={deleteRequest.replacementCategory}
                      onChange={(event) =>
                        setDeleteRequest((current) =>
                          current
                            ? { ...current, replacementCategory: event.target.value }
                            : current,
                        )
                      }
                    >
                      {visibleCategories
                        .filter((category) => category.id !== deleteRequest.category)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {categoryLabel(category, language, t)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={isSavingCategories}
                    onClick={() => {
                      void confirmDeleteCategory();
                    }}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                    {t("common.delete")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setDeleteRequest(null)}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {visibleCategories.map((category) => {
                const usageCount = exercises.filter(
                  (exercise) => exercise.category === category.id,
                ).length;

                return (
                  <div
                    key={category.id}
                    className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/70 p-3 lg:grid-cols-[minmax(0,1fr)_7rem_auto] lg:items-end"
                  >
                    <label className="space-y-2">
                      <span className="label">
                        {t("exercises.categoryUsage", { count: usageCount })}
                      </span>
                      <input
                        className="field"
                        value={categoryDrafts[category.id] ?? categoryLabel(category, language, t)}
                        onChange={(event) => {
                          setCategoryDrafts((current) => ({
                            ...current,
                            [category.id]: event.target.value,
                          }));
                          setCategoryError(null);
                          setCategoryMessage(null);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isSavingCategories}
                      onClick={() => {
                        void renameCategory(category);
                      }}
                    >
                      <Save aria-hidden="true" size={17} />
                      {t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={isSavingCategories}
                      onClick={() => requestDeleteCategory(category.id)}
                    >
                      <Trash2 aria-hidden="true" size={17} />
                      {t("common.delete")}
                    </button>
                  </div>
                );
              })}
            </div>

            {categoryError ? (
              <div className="mt-4 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {categoryError}
              </div>
            ) : null}
            {categoryMessage ? (
              <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {categoryMessage}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="panel flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-50">
                    {translateExerciseName(exercise, language)}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {getCategoryLabel(exercise.category)} -{" "}
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

              <div className="mt-auto flex justify-end gap-2">
                <button
                  type="button"
                  className="secondary-button px-3"
                  aria-label={`${t("common.edit")} ${translateExerciseName(exercise, language)}`}
                  onClick={() => openEditForm(exercise)}
                >
                  <Edit3 aria-hidden="true" size={16} />
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
    </section>
  );
}
