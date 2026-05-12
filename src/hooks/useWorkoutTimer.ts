import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings } from "../models/settings";
import type { WorkoutSession, WorkoutSessionStep } from "../models/session";
import type { WorkoutPlan } from "../models/workout";
import {
  createSessionStep,
  createWorkoutSession,
  getBreakAnnouncement,
  getCompleteAnnouncement,
  getNextStep,
  getStepAnnouncement,
} from "../services/workoutEngine";
import { cancelSpeech, speak } from "../services/speechService";

export type TimerPhase =
  | "idle"
  | "exercise_time"
  | "exercise_reps"
  | "break"
  | "paused"
  | "completed"
  | "stopped";

export type WorkoutRuntimeState = {
  phase: TimerPhase;
  previousPhase?: TimerPhase;
  currentRound: number;
  totalRounds: number;
  currentStepIndex: number;
  remainingSeconds: number;
  startedAt?: string;
  completedAt?: string;
};

type UseWorkoutTimerOptions = {
  plan: WorkoutPlan;
  settings: AppSettings;
  onComplete: (session: WorkoutSession) => void | Promise<void>;
};

type RuntimeWeightMap = Record<string, number | null>;

type CompletedStepRecord = {
  key: string;
  step: WorkoutSessionStep;
};

function createInitialState(plan: WorkoutPlan): WorkoutRuntimeState {
  return {
    phase: "idle",
    currentRound: 1,
    totalRounds: plan.rounds,
    currentStepIndex: 0,
    remainingSeconds: 0,
  };
}

function isCountdownPhase(phase: TimerPhase): boolean {
  return phase === "exercise_time" || phase === "break";
}

function createStepKey(round: number, stepIndex: number): string {
  return `${round}:${stepIndex}`;
}

function resolveStepWeight(
  weights: RuntimeWeightMap,
  key: string,
  defaultWeight?: number,
): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(weights, key)) {
    return defaultWeight;
  }

  const weight = weights[key];

  return weight === null ? undefined : weight;
}

export function useWorkoutTimer({ plan, settings, onComplete }: UseWorkoutTimerOptions) {
  const [state, setState] = useState<WorkoutRuntimeState>(() => createInitialState(plan));
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const [runtimeWeights, setRuntimeWeights] = useState<RuntimeWeightMap>({});
  const stateRef = useRef(state);
  const runtimeWeightsRef = useRef<RuntimeWeightMap>({});
  const targetEndTimeRef = useRef<number | null>(null);
  const completedStepKeysRef = useRef<Set<string>>(new Set());
  const completedStepRecordsRef = useRef<CompletedStepRecord[]>([]);
  const sessionSavedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    targetEndTimeRef.current = null;
    runtimeWeightsRef.current = {};
    completedStepKeysRef.current = new Set();
    completedStepRecordsRef.current = [];
    sessionSavedRef.current = false;
    setRuntimeWeights({});
    setCompletedSession(null);
    setState(createInitialState(plan));
    cancelSpeech();
  }, [plan]);

  const announce = useCallback(
    (text: string) => {
      if (!settings.voiceEnabled) {
        return;
      }

      speak(text, {
        voiceURI: settings.voiceURI,
        rate: settings.voiceRate,
        pitch: settings.voicePitch,
        volume: settings.voiceVolume,
      });
    },
    [settings],
  );

  const recordStepCompletion = useCallback(
    (round: number, stepIndex: number) => {
      const key = createStepKey(round, stepIndex);
      const step = plan.steps[stepIndex];

      if (!step || completedStepKeysRef.current.has(key)) {
        return;
      }

      completedStepKeysRef.current.add(key);
      completedStepRecordsRef.current = [
        ...completedStepRecordsRef.current,
        {
          key,
          step: createSessionStep(
            step,
            round,
            resolveStepWeight(runtimeWeightsRef.current, key, step.weight),
          ),
        },
      ];
    },
    [plan.steps],
  );

  const completeWorkout = useCallback(() => {
    if (sessionSavedRef.current) {
      return;
    }

    const current = stateRef.current;
    const completedAt = new Date().toISOString();
    const startedAt = current.startedAt ?? completedAt;
    const session = createWorkoutSession(
      plan,
      startedAt,
      completedAt,
      completedStepRecordsRef.current.map((record) => record.step),
    );

    sessionSavedRef.current = true;
    targetEndTimeRef.current = null;
    setCompletedSession(session);
    setState({
      ...current,
      phase: "completed",
      previousPhase: undefined,
      remainingSeconds: 0,
      completedAt,
    });
    announce(getCompleteAnnouncement(settings.language));
    void onComplete(session);
  }, [announce, onComplete, plan, settings.language]);

  const beginStep = useCallback(
    (round: number, stepIndex: number, startedAt?: string) => {
      const step = plan.steps[stepIndex];

      if (!step) {
        completeWorkout();
        return;
      }

      announce(getStepAnnouncement(step, settings.language));

      if (step.type === "time") {
        targetEndTimeRef.current = Date.now() + step.durationSeconds * 1000;
        setState((previousState) => ({
          ...previousState,
          phase: "exercise_time",
          previousPhase: undefined,
          currentRound: round,
          currentStepIndex: stepIndex,
          remainingSeconds: step.durationSeconds,
          totalRounds: plan.rounds,
          startedAt: startedAt ?? previousState.startedAt ?? new Date().toISOString(),
          completedAt: undefined,
        }));
        return;
      }

      targetEndTimeRef.current = null;
      setState((previousState) => ({
        ...previousState,
        phase: "exercise_reps",
        previousPhase: undefined,
        currentRound: round,
        currentStepIndex: stepIndex,
        remainingSeconds: 0,
        totalRounds: plan.rounds,
        startedAt: startedAt ?? previousState.startedAt ?? new Date().toISOString(),
        completedAt: undefined,
      }));
    },
    [announce, completeWorkout, plan, settings.language],
  );

  const advanceAfterBreak = useCallback(
    (round: number, stepIndex: number) => {
      if (stepIndex + 1 < plan.steps.length) {
        beginStep(round, stepIndex + 1);
        return;
      }

      if (round < plan.rounds) {
        beginStep(round + 1, 0);
        return;
      }

      completeWorkout();
    },
    [beginStep, completeWorkout, plan.rounds, plan.steps.length],
  );

  const moveToBreak = useCallback(
    (round: number, stepIndex: number) => {
      const step = plan.steps[stepIndex];

      if (!step) {
        completeWorkout();
        return;
      }

      recordStepCompletion(round, stepIndex);

      if (step.breakSeconds <= 0) {
        advanceAfterBreak(round, stepIndex);
        return;
      }

      announce(getBreakAnnouncement(step.breakSeconds, settings.language));
      targetEndTimeRef.current = Date.now() + step.breakSeconds * 1000;
      setState((previousState) => ({
        ...previousState,
        phase: "break",
        previousPhase: undefined,
        currentRound: round,
        currentStepIndex: stepIndex,
        remainingSeconds: step.breakSeconds,
      }));
    },
    [advanceAfterBreak, announce, completeWorkout, plan.steps, recordStepCompletion, settings.language],
  );

  useEffect(() => {
    if (!isCountdownPhase(state.phase)) {
      return undefined;
    }

    const tick = () => {
      const targetEndTime = targetEndTimeRef.current;

      if (!targetEndTime) {
        return;
      }

      const remainingSeconds = Math.max(
        0,
        Math.ceil((targetEndTime - Date.now()) / 1000),
      );

      setState((previousState) =>
        previousState.remainingSeconds === remainingSeconds
          ? previousState
          : {
              ...previousState,
              remainingSeconds,
            },
      );

      if (remainingSeconds > 0) {
        return;
      }

      targetEndTimeRef.current = null;
      const current = stateRef.current;

      if (current.phase === "exercise_time") {
        moveToBreak(current.currentRound, current.currentStepIndex);
      } else if (current.phase === "break") {
        advanceAfterBreak(current.currentRound, current.currentStepIndex);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [advanceAfterBreak, moveToBreak, state.currentRound, state.currentStepIndex, state.phase]);

  const startWorkout = useCallback(() => {
    if (plan.steps.length === 0) {
      return;
    }

    const startedAt = new Date().toISOString();
    completedStepKeysRef.current = new Set();
    completedStepRecordsRef.current = [];
    runtimeWeightsRef.current = {};
    setRuntimeWeights({});
    sessionSavedRef.current = false;
    setCompletedSession(null);
    setState({
      ...createInitialState(plan),
      startedAt,
    });
    beginStep(1, 0, startedAt);
  }, [beginStep, plan]);

  const pauseWorkout = useCallback(() => {
    const current = stateRef.current;

    if (
      current.phase !== "exercise_time" &&
      current.phase !== "exercise_reps" &&
      current.phase !== "break"
    ) {
      return;
    }

    const remainingSeconds = targetEndTimeRef.current
      ? Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000))
      : current.remainingSeconds;

    targetEndTimeRef.current = null;
    setState((previousState) => ({
      ...previousState,
      phase: "paused",
      previousPhase: current.phase,
      remainingSeconds,
    }));
  }, []);

  const resumeWorkout = useCallback(() => {
    const current = stateRef.current;

    if (current.phase !== "paused" || !current.previousPhase) {
      return;
    }

    if (isCountdownPhase(current.previousPhase)) {
      targetEndTimeRef.current = Date.now() + current.remainingSeconds * 1000;
    }

    setState((previousState) => ({
      ...previousState,
      phase: current.previousPhase ?? "idle",
      previousPhase: undefined,
    }));
  }, []);

  const stopWorkout = useCallback(() => {
    cancelSpeech();
    targetEndTimeRef.current = null;
    setState((previousState) => ({
      ...previousState,
      phase: "stopped",
      previousPhase: undefined,
      remainingSeconds: 0,
      completedAt: new Date().toISOString(),
    }));
  }, []);

  const completeRepsStep = useCallback(() => {
    const current = stateRef.current;

    if (current.phase !== "exercise_reps") {
      return;
    }

    moveToBreak(current.currentRound, current.currentStepIndex);
  }, [moveToBreak]);

  const updateCurrentStepWeight = useCallback((weight: number | undefined) => {
    const current = stateRef.current;
    const key = createStepKey(current.currentRound, current.currentStepIndex);
    const nextWeights = {
      ...runtimeWeightsRef.current,
      [key]: typeof weight === "number" ? weight : null,
    };

    runtimeWeightsRef.current = nextWeights;
    setRuntimeWeights(nextWeights);
    completedStepRecordsRef.current = completedStepRecordsRef.current.map((record) =>
      record.key === key
        ? {
            ...record,
            step: {
              ...record.step,
              weight,
            },
          }
        : record,
    );
  }, []);

  const currentStep = plan.steps[state.currentStepIndex];
  const currentStepWeight = currentStep
    ? resolveStepWeight(
        runtimeWeights,
        createStepKey(state.currentRound, state.currentStepIndex),
        currentStep.weight,
      )
    : undefined;
  const nextStep = useMemo(
    () => getNextStep(plan, state.currentStepIndex, state.currentRound),
    [plan, state.currentRound, state.currentStepIndex],
  );

  return {
    state,
    currentStep,
    currentStepWeight,
    nextStep,
    completedSession,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    stopWorkout,
    completeRepsStep,
    updateCurrentStepWeight,
  };
}
