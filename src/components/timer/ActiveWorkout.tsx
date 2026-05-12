import { Check, Pause, Play, RotateCcw, Square, TimerReset } from "lucide-react";
import type { AppSettings } from "../../models/settings";
import type { WorkoutSession } from "../../models/session";
import type { WorkoutPlan, WorkoutStep } from "../../models/workout";
import { useWorkoutTimer } from "../../hooks/useWorkoutTimer";
import { formatDateTime, formatSeconds, getElapsedSeconds } from "../../utils/format";

type ActiveWorkoutProps = {
  plan: WorkoutPlan | null;
  plans: WorkoutPlan[];
  settings: AppSettings;
  onSelectPlan: (plan: WorkoutPlan | null) => void;
  onSessionComplete: (session: WorkoutSession) => void | Promise<void>;
};

function formatTimerDisplay(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function describeStep(step?: WorkoutStep, options?: { weight?: number }): string {
  if (!step) {
    return "No next step";
  }

  const target = step.type === "time" ? `${step.durationSeconds}s` : `${step.reps} reps`;
  const selectedWeight = options ? options.weight : step.weight;
  const weight = typeof selectedWeight === "number" ? ` - ${selectedWeight} kg` : "";
  return `${step.exerciseName} · ${target}${weight}`;
}

function parseOptionalWeight(value: string): number | undefined {
  const parsed = Number(value);

  return value === "" || !Number.isFinite(parsed) ? undefined : Math.max(0, parsed);
}

function PlanChooser({
  plans,
  onSelectPlan,
}: Pick<ActiveWorkoutProps, "plans" | "onSelectPlan">) {
  return (
    <section className="space-y-4">
      <div>
        <p className="label">Timer</p>
        <h2 className="text-2xl font-bold text-slate-50">Choose a workout</h2>
      </div>
      {plans.length === 0 ? (
        <div className="panel p-6 text-slate-300">
          Create and save a workout plan in the Builder before starting the timer.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="panel flex flex-col gap-4 p-4">
              <div>
                <h3 className="text-lg font-bold text-slate-50">{plan.name}</h3>
                <p className="text-sm text-slate-400">
                  {plan.steps.length} steps · {plan.rounds} round{plan.rounds === 1 ? "" : "s"}
                </p>
              </div>
              <button type="button" className="primary-button mt-auto" onClick={() => onSelectPlan(plan)}>
                <Play aria-hidden="true" size={18} />
                Start workout
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionSummary({ session }: { session: WorkoutSession }) {
  return (
    <div className="panel p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">Session Summary</p>
          <h3 className="text-xl font-bold text-slate-50">{session.workoutName}</h3>
          <p className="text-sm text-slate-400">
            {formatDateTime(session.startedAt)} · {formatSeconds(getElapsedSeconds(session.startedAt, session.completedAt))}
          </p>
        </div>
        <span className="rounded-md bg-emerald-400 px-3 py-1 text-sm font-bold text-emerald-950">
          Saved
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {session.steps.map((step) => (
          <div key={step.id} className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs font-semibold uppercase text-cyan-200">Round {step.round}</p>
            <p className="font-semibold text-slate-50">{step.exerciseName}</p>
            <p className="text-sm text-slate-400">
              {step.type === "time" ? `${step.durationSeconds}s` : `${step.reps} reps`}
              {typeof step.weight === "number" ? ` · ${step.weight} kg` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkoutRunner({
  plan,
  settings,
  onSelectPlan,
  onSessionComplete,
}: {
  plan: WorkoutPlan;
  settings: AppSettings;
  onSelectPlan: (plan: WorkoutPlan | null) => void;
  onSessionComplete: (session: WorkoutSession) => void | Promise<void>;
}) {
  const {
    completedSession,
    completeRepsStep,
    currentStep,
    currentStepWeight,
    nextStep,
    pauseWorkout,
    resumeWorkout,
    startWorkout,
    state,
    stopWorkout,
    updateCurrentStepWeight,
  } = useWorkoutTimer({
    plan,
    settings,
    onComplete: onSessionComplete,
  });

  const isRunning =
    state.phase === "exercise_time" || state.phase === "exercise_reps" || state.phase === "break";
  const isCountdown = state.phase === "exercise_time" || state.phase === "break";
  const completedStepCount =
    (state.currentRound - 1) * plan.steps.length +
    state.currentStepIndex +
    (state.phase === "break" || state.phase === "completed" ? 1 : 0);
  const totalStepCount = plan.steps.length * plan.rounds;
  const progressPercent =
    totalStepCount === 0 ? 0 : Math.min(100, Math.round((completedStepCount / totalStepCount) * 100));
  const canAdjustWeight =
    Boolean(currentStep) &&
    state.phase !== "idle" &&
    state.phase !== "stopped" &&
    state.phase !== "completed";

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Active Workout</p>
          <h2 className="text-2xl font-bold text-slate-50">{plan.name}</h2>
          <p className="text-sm text-slate-400">
            Round {state.currentRound} of {state.totalRounds} · Step{" "}
            {Math.min(state.currentStepIndex + 1, plan.steps.length)} of {plan.steps.length}
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => onSelectPlan(null)}>
          <TimerReset aria-hidden="true" size={17} />
          Choose plan
        </button>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <div
          className="h-full rounded-full bg-cyan-300 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="panel p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-h-[23rem] flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-5">
            <div className="space-y-2">
              <p className="label">
                {state.phase === "break"
                  ? "Break"
                  : state.phase === "paused"
                    ? "Paused"
                    : state.phase === "completed"
                      ? "Complete"
                      : "Exercise"}
              </p>
              <h3 className="break-words text-3xl font-black text-slate-50 sm:text-4xl">
                {state.phase === "break" ? "Recover" : currentStep?.exerciseName ?? plan.name}
              </h3>
              <p className="text-base text-slate-400">
                {state.phase === "idle"
                  ? "Ready to start"
                  : state.phase === "stopped"
                    ? "Workout stopped"
                    : describeStep(currentStep, { weight: currentStepWeight })}
              </p>
            </div>

            <div className="py-8 text-center">
              {state.phase === "exercise_reps" && currentStep?.type === "reps" ? (
                <div>
                  <div className="text-7xl font-black tracking-normal text-cyan-200 sm:text-8xl">
                    {currentStep.reps}
                  </div>
                  <p className="mt-2 text-xl font-semibold text-slate-300">reps</p>
                </div>
              ) : (
                <div className="text-7xl font-black tracking-normal text-cyan-200 sm:text-8xl">
                  {isCountdown ? formatTimerDisplay(state.remainingSeconds) : "--:--"}
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(state.phase === "idle" || state.phase === "stopped" || state.phase === "completed") && (
                <button type="button" className="primary-button min-h-14" onClick={startWorkout}>
                  {state.phase === "completed" ? (
                    <RotateCcw aria-hidden="true" size={20} />
                  ) : (
                    <Play aria-hidden="true" size={20} />
                  )}
                  {state.phase === "completed" ? "Restart" : "Start"}
                </button>
              )}
              {isRunning ? (
                <button type="button" className="secondary-button min-h-14" onClick={pauseWorkout}>
                  <Pause aria-hidden="true" size={20} />
                  Pause
                </button>
              ) : null}
              {state.phase === "paused" ? (
                <button type="button" className="primary-button min-h-14" onClick={resumeWorkout}>
                  <Play aria-hidden="true" size={20} />
                  Resume
                </button>
              ) : null}
              {state.phase === "exercise_reps" ? (
                <button type="button" className="primary-button min-h-14" onClick={completeRepsStep}>
                  <Check aria-hidden="true" size={20} />
                  Done
                </button>
              ) : null}
              {(isRunning || state.phase === "paused") ? (
                <button
                  type="button"
                  className="danger-button min-h-14"
                  onClick={() => {
                    if (window.confirm("Stop this workout? The partial session will not be saved.")) {
                      stopWorkout();
                    }
                  }}
                >
                  <Square aria-hidden="true" size={19} />
                  Stop
                </button>
              ) : null}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <p className="label">Next</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">{describeStep(nextStep)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <p className="label">Break after this step</p>
              <p className="mt-2 text-3xl font-black text-amber-200">
                {currentStep ? formatSeconds(currentStep.breakSeconds) : "0s"}
              </p>
            </div>
            {canAdjustWeight ? (
              <label className="block rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <span className="label">Actual weight kg</span>
                <input
                  className="field mt-2"
                  min={0}
                  placeholder="Optional"
                  step={0.5}
                  type="number"
                  value={currentStepWeight ?? ""}
                  onChange={(event) => updateCurrentStepWeight(parseOptionalWeight(event.target.value))}
                />
              </label>
            ) : null}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <p className="label">Voice</p>
              <p className="mt-2 text-sm text-slate-300">
                {settings.voiceEnabled ? "Enabled" : "Disabled"} · Rate {settings.voiceRate.toFixed(1)}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {completedSession ? <SessionSummary session={completedSession} /> : null}
    </section>
  );
}

export function ActiveWorkout({
  plan,
  plans,
  settings,
  onSelectPlan,
  onSessionComplete,
}: ActiveWorkoutProps) {
  if (!plan) {
    return <PlanChooser plans={plans} onSelectPlan={onSelectPlan} />;
  }

  return (
    <WorkoutRunner
      plan={plan}
      settings={settings}
      onSelectPlan={onSelectPlan}
      onSessionComplete={onSessionComplete}
    />
  );
}
