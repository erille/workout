import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Play, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { translateExerciseName } from "../../i18n/exerciseNames";
import type { Exercise } from "../../models/exercise";
import type { WorkoutPlan, WorkoutStep } from "../../models/workout";
import { createId } from "../../utils/id";

type WorkoutBuilderProps = {
  exercises: Exercise[];
  plans: WorkoutPlan[];
  onSavePlan: (plan: WorkoutPlan) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onStartPlan: (plan: WorkoutPlan) => void;
};

type DraftPlan = {
  id?: string;
  name: string;
  rounds: number;
  steps: WorkoutStep[];
  createdAt?: string;
};

type StepDefaults = {
  durationSeconds: number;
  reps: number;
  distanceMeters: number;
  breakSeconds: number;
  weight?: number;
};

const emptyDraft: DraftPlan = {
  name: "Full body session",
  rounds: 1,
  steps: [],
};

function clonePlanToDraft(plan: WorkoutPlan): DraftPlan {
  return {
    id: plan.id,
    name: plan.name,
    rounds: plan.rounds,
    steps: plan.steps,
    createdAt: plan.createdAt,
  };
}

function createStepFromExercise(
  exercise: Exercise,
  type: WorkoutStep["type"],
  defaults: StepDefaults,
): WorkoutStep {
  const common = {
    id: createId("step"),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    breakSeconds: defaults.breakSeconds,
    weight: defaults.weight,
  };

  if (type === "time") {
    return {
      ...common,
      type: "time",
      durationSeconds: exercise.defaultDurationSeconds ?? defaults.durationSeconds,
    };
  }

  if (type === "distance") {
    return {
      ...common,
      type: "distance",
      distanceMeters: exercise.defaultDistanceMeters ?? defaults.distanceMeters,
    };
  }

  return {
    ...common,
    type: "reps",
    reps: exercise.defaultReps ?? defaults.reps,
  };
}

function getStepTarget(
  step: WorkoutStep,
  labels: { reps: string; meters: string },
): string {
  const target =
    step.type === "time"
      ? `${step.durationSeconds}s`
      : step.type === "distance"
        ? `${step.distanceMeters} ${labels.meters}`
        : `${step.reps} ${labels.reps}`;
  const weight = typeof step.weight === "number" ? ` - ${step.weight} kg` : "";

  return `${target}${weight}`;
}

function parseOptionalWeight(value: string): number | undefined {
  const parsed = Number(value);

  return value === "" || !Number.isFinite(parsed) ? undefined : Math.max(0, parsed);
}

type SortableStepProps = {
  step: WorkoutStep;
  index: number;
  defaults: StepDefaults;
  onRemove: (stepId: string) => void;
  onChangeType: (stepId: string, type: WorkoutStep["type"]) => void;
  onUpdate: (stepId: string, update: (step: WorkoutStep) => WorkoutStep) => void;
};

function SortableStep({
  step,
  index,
  defaults,
  onChangeType,
  onRemove,
  onUpdate,
}: SortableStepProps) {
  const { language, t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`panel p-4 ${isDragging ? "border-cyan-300/80 bg-slate-800" : ""}`}
    >
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(13rem,1fr)_minmax(0,2.2fr)_auto] xl:items-start">
        <button
          type="button"
          className="secondary-button w-fit px-3"
          aria-label={`Drag ${step.exerciseName}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={18} />
        </button>

        <div>
          <p className="text-sm font-semibold text-cyan-200">
            {t("builder.step", { number: index + 1 })}
          </p>
          <h3 className="break-words text-lg font-bold text-slate-50">
            {translateExerciseName(step, language)}
          </h3>
          <p className="text-sm text-slate-400">
            {getStepTarget(step, { reps: t("common.reps"), meters: t("common.meters") })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="label">{t("builder.type")}</span>
            <select
              className="field"
              value={step.type}
              onChange={(event) =>
                onChangeType(step.id, event.target.value as WorkoutStep["type"])
              }
            >
              <option value="time">{t("common.time")}</option>
              <option value="reps">{t("common.reps")}</option>
              <option value="distance">{t("common.distance")}</option>
            </select>
          </label>

          {step.type === "time" ? (
            <label className="space-y-2">
              <span className="label">{t("builder.duration")}</span>
              <input
                className="field"
                min={1}
                type="number"
                value={step.durationSeconds}
                onChange={(event) =>
                  onUpdate(step.id, (current) =>
                    current.type === "time"
                      ? {
                          ...current,
                          durationSeconds: Math.max(1, Math.round(Number(event.target.value))),
                        }
                      : current,
                  )
                }
              />
            </label>
          ) : step.type === "distance" ? (
            <label className="space-y-2">
              <span className="label">{t("common.meters")}</span>
              <input
                className="field"
                min={1}
                type="number"
                value={step.distanceMeters}
                onChange={(event) =>
                  onUpdate(step.id, (current) =>
                    current.type === "distance"
                      ? {
                          ...current,
                          distanceMeters: Math.max(1, Math.round(Number(event.target.value))),
                        }
                      : current,
                  )
                }
              />
            </label>
          ) : (
            <label className="space-y-2">
              <span className="label">{t("common.reps")}</span>
              <input
                className="field"
                min={1}
                type="number"
                value={step.reps}
                onChange={(event) =>
                  onUpdate(step.id, (current) =>
                    current.type === "reps"
                      ? {
                          ...current,
                          reps: Math.max(1, Math.round(Number(event.target.value))),
                        }
                      : current,
                  )
                }
              />
            </label>
          )}

          <label className="space-y-2">
            <span className="label">{t("builder.break")}</span>
            <input
              className="field"
              min={0}
              type="number"
              value={step.breakSeconds}
              onChange={(event) =>
                onUpdate(step.id, (current) => ({
                  ...current,
                  breakSeconds: Math.max(0, Math.round(Number(event.target.value))),
                }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="label">{t("builder.weightKg")}</span>
            <input
              className="field"
              min={0}
              step={0.5}
              placeholder={t("common.optional")}
              type="number"
              value={step.weight ?? ""}
              onChange={(event) => {
                onUpdate(step.id, (current) => ({
                  ...current,
                  weight: parseOptionalWeight(event.target.value),
                }));
              }}
            />
          </label>
        </div>

        <button
          type="button"
          className="danger-button h-11 px-3"
          aria-label={`Remove ${step.exerciseName}`}
          onClick={() => onRemove(step.id)}
        >
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {t("builder.defaults", {
          duration: defaults.durationSeconds,
          reps: defaults.reps,
          meters: defaults.distanceMeters,
          breakSeconds: defaults.breakSeconds,
          weight: typeof defaults.weight === "number" ? ` - ${defaults.weight} kg` : "",
        })}
      </div>
    </article>
  );
}

export function WorkoutBuilder({
  exercises,
  onDeletePlan,
  onSavePlan,
  onStartPlan,
  plans,
}: WorkoutBuilderProps) {
  const { language, t } = useI18n();
  const [draft, setDraft] = useState<DraftPlan>({
    ...emptyDraft,
    name: t("builder.defaultName"),
  });
  const [defaults, setDefaults] = useState<StepDefaults>({
    durationSeconds: 45,
    reps: 12,
    distanceMeters: 500,
    breakSeconds: 15,
  });
  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0]?.id ?? "");
  const [selectedStepType, setSelectedStepType] = useState<WorkoutStep["type"]>(
    exercises[0]?.defaultMode ?? "reps",
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(normalizedQuery) ||
      translateExerciseName(exercise, language).toLowerCase().includes(normalizedQuery),
    );
  }, [exercises, language, query]);

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId);

  useEffect(() => {
    if (exercises.length === 0) {
      return;
    }

    const selectedExerciseExists = exercises.some((exercise) => exercise.id === selectedExerciseId);

    if (!selectedExerciseExists) {
      setSelectedExerciseId(exercises[0].id);
      setSelectedStepType(exercises[0].defaultMode);
    }
  }, [exercises, selectedExerciseId]);

  const updateDraftSteps = (update: (steps: WorkoutStep[]) => WorkoutStep[]) => {
    setDraft((current) => ({ ...current, steps: update(current.steps) }));
  };

  const addSelectedExercise = () => {
    if (!selectedExercise) {
      return;
    }

    updateDraftSteps((steps) => [
      ...steps,
      createStepFromExercise(selectedExercise, selectedStepType, defaults),
    ]);
    setMessage(t("builder.added", { name: translateExerciseName(selectedExercise, language) }));
  };

  const updateStep = (stepId: string, update: (step: WorkoutStep) => WorkoutStep) => {
    updateDraftSteps((steps) => steps.map((step) => (step.id === stepId ? update(step) : step)));
  };

  const changeStepType = (stepId: string, type: WorkoutStep["type"]) => {
    updateStep(stepId, (step) => {
      const common = {
        id: step.id,
        exerciseId: step.exerciseId,
        exerciseName: step.exerciseName,
        breakSeconds: step.breakSeconds,
        weight: step.weight,
      };

      if (type === "time") {
        return {
          ...common,
          type,
          durationSeconds: step.type === "time" ? step.durationSeconds : defaults.durationSeconds,
        };
      }

      if (type === "distance") {
        return {
          ...common,
          type,
          distanceMeters:
            step.type === "distance" ? step.distanceMeters : defaults.distanceMeters,
        };
      }

      return {
        ...common,
        type,
        reps: step.type === "reps" ? step.reps : defaults.reps,
      };
    });
  };

  const removeStep = (stepId: string) => {
    updateDraftSteps((steps) => steps.filter((step) => step.id !== stepId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    updateDraftSteps((steps) => {
      const oldIndex = steps.findIndex((step) => step.id === active.id);
      const newIndex = steps.findIndex((step) => step.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return steps;
      }

      return arrayMove(steps, oldIndex, newIndex);
    });
  };

  const buildPlan = (): WorkoutPlan | null => {
    const name = draft.name.trim();

    if (!name) {
      setError(t("builder.errorName"));
      return null;
    }

    if (draft.steps.length === 0) {
      setError(t("builder.errorSteps"));
      return null;
    }

    const invalidStep = draft.steps.find((step) => {
      if (step.breakSeconds < 0 || (step.weight ?? 0) < 0) {
        return true;
      }

      if (step.type === "time") {
        return step.durationSeconds <= 0;
      }

      return step.type === "distance" ? step.distanceMeters <= 0 : step.reps <= 0;
    });

    if (invalidStep) {
      setError(t("builder.errorValues"));
      return null;
    }

    const now = new Date().toISOString();

    return {
      id: draft.id ?? createId("plan"),
      name,
      rounds: Math.max(1, Math.round(draft.rounds)),
      steps: draft.steps,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    };
  };

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    setMessage(null);

    const plan = buildPlan();

    if (!plan) {
      return null;
    }

    await onSavePlan(plan);
    setDraft(clonePlanToDraft(plan));
    setMessage(t("builder.saved"));
    return plan;
  };

  const handleStart = async () => {
    const plan = await handleSave();

    if (plan) {
      onStartPlan(plan);
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label">{t("builder.plans")}</p>
              <h2 className="text-xl font-bold text-slate-50">{t("builder.savedWorkouts")}</h2>
            </div>
            <button
              type="button"
              className="secondary-button px-3"
              onClick={() => {
                setDraft({ ...emptyDraft, name: t("builder.defaultName"), steps: [] });
                setError(null);
                setMessage(null);
              }}
            >
              <Plus aria-hidden="true" size={17} />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {plans.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                {t("builder.noSavedPlans")}
              </p>
            ) : (
              plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-md border border-slate-800 bg-slate-950/70 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-50">{plan.name}</h3>
                      <p className="text-xs text-slate-400">
                        {plan.steps.length}{" "}
                        {plan.steps.length === 1 ? t("common.step") : t("common.steps")} -{" "}
                        {plan.rounds} {t("common.round").toLowerCase()}
                        {plan.rounds === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="danger-button px-2 py-2"
                      aria-label={`Delete ${plan.name}`}
                      onClick={() => {
                        if (window.confirm(t("builder.deletePlan", { name: plan.name }))) {
                          void onDeletePlan(plan.id);
                        }
                      }}
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="secondary-button px-3"
                      onClick={() => {
                        setDraft(clonePlanToDraft(plan));
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      type="button"
                      className="primary-button px-3"
                      onClick={() => onStartPlan(plan)}
                    >
                      <Play aria-hidden="true" size={16} />
                      {t("common.start")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <form className="space-y-5" onSubmit={handleSave}>
        <div className="panel p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_8rem]">
            <label className="space-y-2">
              <span className="label">{t("builder.workoutName")}</span>
              <input
                className="field text-base"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2">
              <span className="label">{t("common.rounds")}</span>
              <input
                className="field text-base"
                min={1}
                type="number"
                value={draft.rounds}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    rounds: Math.max(1, Math.round(Number(event.target.value))),
                  }))
                }
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_9rem_8rem_9rem_8rem_auto] lg:items-end">
            <label className="space-y-2">
              <span className="label">{t("builder.exercise")}</span>
              <select
                className="field"
                value={selectedExerciseId}
                onChange={(event) => {
                  const nextExercise = exercises.find((exercise) => exercise.id === event.target.value);
                  setSelectedExerciseId(event.target.value);

                  if (nextExercise) {
                    setSelectedStepType(nextExercise.defaultMode);
                  }
                }}
              >
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {translateExerciseName(exercise, language)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="label">{t("builder.type")}</span>
              <select
                className="field"
                value={selectedStepType}
                onChange={(event) => setSelectedStepType(event.target.value as WorkoutStep["type"])}
              >
                <option value="time">{t("common.time")}</option>
                <option value="reps">{t("common.reps")}</option>
                <option value="distance">{t("common.distance")}</option>
              </select>
            </label>

            {selectedStepType === "time" ? (
              <label className="space-y-2">
                <span className="label">{t("common.time")}</span>
                <input
                  className="field"
                  min={1}
                  type="number"
                  value={defaults.durationSeconds}
                  onChange={(event) =>
                    setDefaults((current) => ({
                      ...current,
                      durationSeconds: Math.max(1, Math.round(Number(event.target.value))),
                    }))
                  }
                />
              </label>
            ) : selectedStepType === "distance" ? (
              <label className="space-y-2">
                <span className="label">{t("common.meters")}</span>
                <input
                  className="field"
                  min={1}
                  type="number"
                  value={defaults.distanceMeters}
                  onChange={(event) =>
                    setDefaults((current) => ({
                      ...current,
                      distanceMeters: Math.max(1, Math.round(Number(event.target.value))),
                    }))
                  }
                />
              </label>
            ) : (
              <label className="space-y-2">
                <span className="label">{t("common.reps")}</span>
                <input
                  className="field"
                  min={1}
                  type="number"
                  value={defaults.reps}
                  onChange={(event) =>
                    setDefaults((current) => ({
                      ...current,
                      reps: Math.max(1, Math.round(Number(event.target.value))),
                    }))
                  }
                />
              </label>
            )}

            <label className="space-y-2">
              <span className="label">{t("builder.weightKg")}</span>
              <input
                className="field"
                min={0}
                step={0.5}
                placeholder={t("common.optional")}
                type="number"
                value={defaults.weight ?? ""}
                onChange={(event) =>
                  setDefaults((current) => ({
                    ...current,
                    weight: parseOptionalWeight(event.target.value),
                  }))
                }
              />
            </label>
            <label className="space-y-2">
              <span className="label">{t("builder.break")}</span>
              <input
                className="field"
                min={0}
                type="number"
                value={defaults.breakSeconds}
                onChange={(event) =>
                  setDefaults((current) => ({
                    ...current,
                    breakSeconds: Math.max(0, Math.round(Number(event.target.value))),
                  }))
                }
              />
            </label>
            <button type="button" className="primary-button h-11" onClick={addSelectedExercise}>
              <Plus aria-hidden="true" size={17} />
              {t("common.add")}
            </button>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="label">{t("builder.filter")}</span>
            <input
              className="field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("builder.filterPlaceholder")}
            />
          </label>

          {query.trim() ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300"
                  onClick={() => {
                    setSelectedExerciseId(exercise.id);
                    setQuery("");
                  }}
                >
                  {translateExerciseName(exercise, language)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label">{t("builder.steps")}</p>
              <h2 className="text-2xl font-bold text-slate-50">
                {t("builder.configured", { count: draft.steps.length })}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="secondary-button">
                <Save aria-hidden="true" size={17} />
                {t("builder.savePlan")}
              </button>
              <button type="button" className="primary-button" onClick={handleStart}>
                <Play aria-hidden="true" size={17} />
                {t("builder.saveAndStart")}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {message}
            </div>
          ) : null}

          {draft.steps.length === 0 ? (
            <div className="panel border-dashed p-6 text-center text-slate-400">
              {t("builder.emptySteps")}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={draft.steps.map((step) => step.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {draft.steps.map((step, index) => (
                    <SortableStep
                      key={step.id}
                      defaults={defaults}
                      index={index}
                      step={step}
                      onChangeType={changeStepType}
                      onRemove={removeStep}
                      onUpdate={updateStep}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </form>
    </section>
  );
}
