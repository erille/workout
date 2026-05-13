import { CalendarPlus, Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { translateExerciseName } from "../../i18n/exerciseNames";
import type { Exercise } from "../../models/exercise";
import type { WorkoutSession, WorkoutSessionStep } from "../../models/session";
import { formatDateTime, formatSeconds, getElapsedSeconds } from "../../utils/format";
import { createId } from "../../utils/id";

type WorkoutHistoryProps = {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSaveSession: (session: WorkoutSession) => Promise<void>;
};

type ManualStepForm = {
  id: string;
  exerciseName: string;
  type: "time" | "reps";
  durationSeconds: number;
  reps: number;
  round: number;
  breakSeconds: number;
  weight: string;
};

function stepLabel(step: WorkoutSessionStep, repsLabel: string): string {
  const target = step.type === "time" ? `${step.durationSeconds}s` : `${step.reps} ${repsLabel}`;
  const weight = typeof step.weight === "number" ? ` - ${step.weight} kg` : "";
  return `${target}${weight}`;
}

function createManualStep(): ManualStepForm {
  return {
    id: createId("manual-step"),
    exerciseName: "",
    type: "reps",
    durationSeconds: 60,
    reps: 10,
    round: 1,
    breakSeconds: 0,
    weight: "",
  };
}

function createManualStepFromSessionStep(step: WorkoutSessionStep): ManualStepForm {
  return {
    id: step.id,
    exerciseName: step.exerciseName,
    type: step.type,
    durationSeconds: step.durationSeconds ?? 60,
    reps: step.reps ?? 10,
    round: step.round,
    breakSeconds: step.breakSeconds,
    weight: typeof step.weight === "number" ? String(step.weight) : "",
  };
}

function toDateTimeInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function parseOptionalWeight(value: string): number | undefined {
  const parsed = Number(value);

  return value.trim() === "" || !Number.isFinite(parsed) ? undefined : Math.max(0, parsed);
}

function parseLocalDateTime(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getSessionDurationMinutes(session: WorkoutSession): number {
  const elapsedSeconds = getElapsedSeconds(session.startedAt, session.completedAt);
  return elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / 60)) : 60;
}

export function WorkoutHistory({
  exercises,
  onDeleteSession,
  onSaveSession,
  sessions,
}: WorkoutHistoryProps) {
  const { language, t } = useI18n();
  const [query, setQuery] = useState("");
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [manualWorkoutName, setManualWorkoutName] = useState(t("history.manualDefaultName"));
  const [manualStartedAt, setManualStartedAt] = useState(() => toDateTimeInputValue(new Date()));
  const [manualDurationMinutes, setManualDurationMinutes] = useState(60);
  const [manualSteps, setManualSteps] = useState<ManualStepForm[]>(() => [createManualStep()]);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [isSavingManual, setIsSavingManual] = useState(false);

  const exerciseByName = useMemo(() => {
    return new Map(exercises.map((exercise) => [exercise.name.toLowerCase(), exercise]));
  }, [exercises]);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return sessions;
    }

    return sessions.filter((session) => {
      return (
        session.workoutName.toLowerCase().includes(normalizedQuery) ||
        session.steps.some((step) => {
          return (
            step.exerciseName.toLowerCase().includes(normalizedQuery) ||
            translateExerciseName(step, language).toLowerCase().includes(normalizedQuery)
          );
        })
      );
    });
  }, [language, query, sessions]);

  const resetManualForm = () => {
    setEditingSessionId(null);
    setManualWorkoutName(t("history.manualDefaultName"));
    setManualStartedAt(toDateTimeInputValue(new Date()));
    setManualDurationMinutes(60);
    setManualSteps([createManualStep()]);
    setManualError(null);
  };

  const editSession = (session: WorkoutSession) => {
    setEditingSessionId(session.id);
    setManualWorkoutName(session.workoutName);
    setManualStartedAt(toDateTimeInputValue(new Date(session.startedAt)));
    setManualDurationMinutes(getSessionDurationMinutes(session));
    setManualSteps(
      session.steps.length > 0 ? session.steps.map(createManualStepFromSessionStep) : [createManualStep()],
    );
    setManualError(null);
    setManualMessage(null);
    setIsManualOpen(true);
  };

  const updateManualStep = (stepId: string, update: Partial<ManualStepForm>) => {
    setManualSteps((steps) =>
      steps.map((step) => (step.id === stepId ? { ...step, ...update } : step)),
    );
    setManualError(null);
    setManualMessage(null);
  };

  const addManualStep = () => {
    setManualSteps((steps) => [...steps, createManualStep()]);
    setManualError(null);
    setManualMessage(null);
  };

  const removeManualStep = (stepId: string) => {
    setManualSteps((steps) =>
      steps.length === 1 ? steps : steps.filter((step) => step.id !== stepId),
    );
    setManualError(null);
    setManualMessage(null);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualError(null);
    setManualMessage(null);

    const workoutName = manualWorkoutName.trim() || t("history.manualDefaultName");
    const startedAt = parseLocalDateTime(manualStartedAt);
    const durationMinutes = Math.max(0, Number(manualDurationMinutes));

    if (!workoutName) {
      setManualError(t("history.manualErrorName"));
      return;
    }

    if (!startedAt) {
      setManualError(t("history.manualErrorDate"));
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setManualError(t("history.manualErrorDuration"));
      return;
    }

    if (manualSteps.length === 0) {
      setManualError(t("history.manualErrorSteps"));
      return;
    }

    const steps: WorkoutSessionStep[] = [];

    for (const step of manualSteps) {
      const exerciseName = step.exerciseName.trim();
      const durationSeconds = Math.round(Number(step.durationSeconds));
      const reps = Math.round(Number(step.reps));
      const round = Math.round(Number(step.round));
      const breakSeconds = Math.round(Number(step.breakSeconds));
      const weight = parseOptionalWeight(step.weight);

      if (
        !exerciseName ||
        !Number.isFinite(round) ||
        round < 1 ||
        !Number.isFinite(breakSeconds) ||
        breakSeconds < 0 ||
        (step.type === "time" && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) ||
        (step.type === "reps" && (!Number.isFinite(reps) || reps <= 0)) ||
        (typeof weight === "number" && weight < 0)
      ) {
        setManualError(t("history.manualErrorStepValues"));
        return;
      }

      const knownExercise = exerciseByName.get(exerciseName.toLowerCase());

      steps.push({
        id: createId("session-step"),
        exerciseId: knownExercise?.id,
        exerciseName: knownExercise?.name ?? exerciseName,
        type: step.type,
        durationSeconds: step.type === "time" ? durationSeconds : undefined,
        reps: step.type === "reps" ? reps : undefined,
        breakSeconds,
        weight,
        round,
        completed: true,
      });
    }

    const completedAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
    const roundsCompleted = steps.reduce((maxRound, step) => Math.max(maxRound, step.round), 1);
    const existingSession = editingSessionId
      ? sessions.find((sessionItem) => sessionItem.id === editingSessionId)
      : undefined;
    const session: WorkoutSession = {
      id: existingSession?.id ?? createId("session"),
      workoutPlanId: existingSession?.workoutPlanId,
      workoutName,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      completed: true,
      roundsCompleted,
      steps,
    };

    setIsSavingManual(true);

    try {
      await onSaveSession(session);
      resetManualForm();
      setManualMessage(
        editingSessionId ? t("history.editSaved") : t("history.manualSaved"),
      );
    } catch {
      setManualError(t("history.manualErrorSave"));
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">{t("history.section")}</p>
          <h2 className="text-2xl font-bold text-slate-50">{t("history.title")}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className={isManualOpen ? "secondary-button" : "primary-button"}
            onClick={() => {
              setIsManualOpen((current) => {
                const nextIsOpen = !current;
                if (nextIsOpen) {
                  resetManualForm();
                }
                return nextIsOpen;
              });
              setManualError(null);
              setManualMessage(null);
            }}
          >
            <CalendarPlus aria-hidden="true" size={17} />
            {t("history.manualAdd")}
          </button>
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
              placeholder={t("history.filter")}
              type="search"
            />
          </label>
        </div>
      </div>

      {isManualOpen ? (
        <form className="panel space-y-5 p-4" onSubmit={handleManualSubmit}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="label">{t("history.manualSection")}</p>
              <h3 className="text-xl font-bold text-slate-50">
                {editingSessionId ? t("history.editTitle") : t("history.manualTitle")}
              </h3>
            </div>
            <button
              type="button"
              className="secondary-button w-fit px-3"
              aria-label={t("common.cancel")}
              onClick={() => {
                setIsManualOpen(false);
                resetManualForm();
              }}
            >
              <X aria-hidden="true" size={17} />
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_10rem]">
            <label className="space-y-2">
              <span className="label">{t("history.manualName")}</span>
              <input
                className="field"
                value={manualWorkoutName}
                onChange={(event) => {
                  setManualWorkoutName(event.target.value);
                  setManualError(null);
                  setManualMessage(null);
                }}
                placeholder={t("history.manualDefaultName")}
              />
            </label>
            <label className="space-y-2">
              <span className="label">{t("history.manualDate")}</span>
              <input
                className="field"
                type="datetime-local"
                value={manualStartedAt}
                onChange={(event) => {
                  setManualStartedAt(event.target.value);
                  setManualError(null);
                  setManualMessage(null);
                }}
              />
            </label>
            <label className="space-y-2">
              <span className="label">{t("history.manualDuration")}</span>
              <input
                className="field"
                min={1}
                type="number"
                value={manualDurationMinutes}
                onChange={(event) => {
                  setManualDurationMinutes(Number(event.target.value));
                  setManualError(null);
                  setManualMessage(null);
                }}
              />
            </label>
          </div>

          <datalist id="manual-exercise-options">
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.name} />
            ))}
          </datalist>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-lg font-bold text-slate-50">{t("history.manualSteps")}</h4>
              <button type="button" className="secondary-button w-fit" onClick={addManualStep}>
                <Plus aria-hidden="true" size={17} />
                {t("history.manualAddStep")}
              </button>
            </div>

            <div className="space-y-3">
              {manualSteps.map((step, index) => (
                <article key={step.id} className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(11rem,1fr)_8rem_8rem_6rem_8rem_8rem_auto] lg:items-end">
                    <label className="space-y-2">
                      <span className="label">
                        {t("builder.step", { number: index + 1 })} - {t("common.exercise")}
                      </span>
                      <input
                        className="field"
                        list="manual-exercise-options"
                        value={step.exerciseName}
                        onChange={(event) =>
                          updateManualStep(step.id, { exerciseName: event.target.value })
                        }
                        placeholder={t("history.manualExercisePlaceholder")}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="label">{t("builder.type")}</span>
                      <select
                        className="field"
                        value={step.type}
                        onChange={(event) =>
                          updateManualStep(step.id, { type: event.target.value as ManualStepForm["type"] })
                        }
                      >
                        <option value="reps">{t("common.reps")}</option>
                        <option value="time">{t("common.time")}</option>
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
                            updateManualStep(step.id, { durationSeconds: Number(event.target.value) })
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
                            updateManualStep(step.id, { reps: Number(event.target.value) })
                          }
                        />
                      </label>
                    )}

                    <label className="space-y-2">
                      <span className="label">{t("common.round")}</span>
                      <input
                        className="field"
                        min={1}
                        type="number"
                        value={step.round}
                        onChange={(event) =>
                          updateManualStep(step.id, { round: Number(event.target.value) })
                        }
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="label">{t("builder.weightKg")}</span>
                      <input
                        className="field"
                        min={0}
                        placeholder={t("common.optional")}
                        step={0.5}
                        type="number"
                        value={step.weight}
                        onChange={(event) => updateManualStep(step.id, { weight: event.target.value })}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="label">{t("builder.break")}</span>
                      <input
                        className="field"
                        min={0}
                        type="number"
                        value={step.breakSeconds}
                        onChange={(event) =>
                          updateManualStep(step.id, { breakSeconds: Number(event.target.value) })
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="danger-button h-11 px-3"
                      aria-label={t("history.manualRemoveStep", { number: index + 1 })}
                      disabled={manualSteps.length === 1}
                      onClick={() => removeManualStep(step.id)}
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {manualError ? (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {manualError}
            </div>
          ) : null}
          {manualMessage ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {manualMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="primary-button" disabled={isSavingManual}>
              <Save aria-hidden="true" size={17} />
              {editingSessionId ? t("history.editSave") : t("history.manualSave")}
            </button>
            <button type="button" className="secondary-button" onClick={resetManualForm}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {filteredSessions.length === 0 ? (
        <div className="panel p-6 text-slate-300">
          {sessions.length === 0 ? t("history.noCompleted") : t("history.noMatches")}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <article key={session.id} className="panel p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="label">{formatDateTime(session.startedAt)}</p>
                  <h3 className="text-xl font-bold text-slate-50">{session.workoutName}</h3>
                  <p className="text-sm text-slate-400">
                    {t("history.completedSteps", {
                      rounds: session.roundsCompleted,
                      roundPlural: session.roundsCompleted === 1 ? "" : "s",
                      steps: session.steps.length,
                      duration: formatSeconds(getElapsedSeconds(session.startedAt, session.completedAt)),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="secondary-button w-fit"
                    onClick={() => editSession(session)}
                  >
                    <Edit3 aria-hidden="true" size={17} />
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="danger-button w-fit"
                    onClick={() => {
                      if (window.confirm(t("history.deleteConfirm", { name: session.workoutName }))) {
                        void onDeleteSession(session.id);
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                    {t("common.delete")}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {session.steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-md border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <p className="text-xs font-semibold uppercase text-cyan-200">
                      {t("common.round")} {step.round}
                    </p>
                    <p className="font-semibold text-slate-50">
                      {translateExerciseName(step, language)}
                    </p>
                    <p className="text-sm text-slate-400">{stepLabel(step, t("common.reps"))}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
