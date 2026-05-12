import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { translateExerciseName } from "../../i18n/exerciseNames";
import type { WorkoutSession, WorkoutSessionStep } from "../../models/session";
import { formatDateTime, formatSeconds, getElapsedSeconds } from "../../utils/format";

type WorkoutHistoryProps = {
  sessions: WorkoutSession[];
  onDeleteSession: (sessionId: string) => Promise<void>;
};

function stepLabel(step: WorkoutSessionStep, repsLabel: string): string {
  const target = step.type === "time" ? `${step.durationSeconds}s` : `${step.reps} ${repsLabel}`;
  const weight = typeof step.weight === "number" ? ` - ${step.weight} kg` : "";
  return `${target}${weight}`;
}

export function WorkoutHistory({ onDeleteSession, sessions }: WorkoutHistoryProps) {
  const { language, t } = useI18n();
  const [query, setQuery] = useState("");

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

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">{t("history.section")}</p>
          <h2 className="text-2xl font-bold text-slate-50">{t("history.title")}</h2>
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
            placeholder={t("history.filter")}
            type="search"
          />
        </label>
      </div>

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
