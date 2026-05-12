import { useCallback, useEffect, useState } from "react";
import { getWorkoutPlans, saveWorkoutPlans, type StorageMode } from "../data/storage";
import type { WorkoutPlan } from "../models/workout";

function sortPlans(plans: WorkoutPlan[]): WorkoutPlan[] {
  return [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useWorkoutPlans(mode: StorageMode, enabled = true) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loadedMode, setLoadedMode] = useState<StorageMode | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getWorkoutPlans(mode)
      .then((loadedPlans) => {
        if (isMounted) {
          setPlans(sortPlans(loadedPlans));
          setLoadedMode(mode);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, mode]);

  const visiblePlans = loadedMode === mode ? plans : [];

  const persistPlans = useCallback(async (nextPlans: WorkoutPlan[]) => {
    const sortedPlans = sortPlans(nextPlans);
    setPlans(sortedPlans);
    setLoadedMode(mode);
    await saveWorkoutPlans(sortedPlans, mode);
  }, [mode]);

  const savePlan = useCallback(
    async (plan: WorkoutPlan) => {
      const existing = visiblePlans.find((item) => item.id === plan.id);
      const nextPlans = existing
        ? visiblePlans.map((item) => (item.id === plan.id ? plan : item))
        : [...visiblePlans, plan];

      await persistPlans(nextPlans);
    },
    [persistPlans, visiblePlans],
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      await persistPlans(visiblePlans.filter((plan) => plan.id !== planId));
    },
    [persistPlans, visiblePlans],
  );

  return {
    plans: visiblePlans,
    isLoading: enabled && (isLoading || loadedMode !== mode),
    savePlan,
    deletePlan,
  };
}
