import { useCallback, useEffect, useState } from "react";
import { getWorkoutPlans, saveWorkoutPlans } from "../data/storage";
import type { WorkoutPlan } from "../models/workout";

function sortPlans(plans: WorkoutPlan[]): WorkoutPlan[] {
  return [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useWorkoutPlans(enabled = true) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getWorkoutPlans()
      .then((loadedPlans) => {
        if (isMounted) {
          setPlans(sortPlans(loadedPlans));
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
  }, [enabled]);

  const persistPlans = useCallback(async (nextPlans: WorkoutPlan[]) => {
    const sortedPlans = sortPlans(nextPlans);
    setPlans(sortedPlans);
    await saveWorkoutPlans(sortedPlans);
  }, []);

  const savePlan = useCallback(
    async (plan: WorkoutPlan) => {
      const existing = plans.find((item) => item.id === plan.id);
      const nextPlans = existing
        ? plans.map((item) => (item.id === plan.id ? plan : item))
        : [...plans, plan];

      await persistPlans(nextPlans);
    },
    [persistPlans, plans],
  );

  const deletePlan = useCallback(
    async (planId: string) => {
      await persistPlans(plans.filter((plan) => plan.id !== planId));
    },
    [persistPlans, plans],
  );

  return {
    plans,
    isLoading,
    savePlan,
    deletePlan,
  };
}
