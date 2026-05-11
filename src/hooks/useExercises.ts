import { useCallback, useEffect, useState } from "react";
import { getExercises, saveExercises } from "../data/storage";
import type { Exercise } from "../models/exercise";

function sortExercises(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
}

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getExercises()
      .then((loadedExercises) => {
        if (isMounted) {
          setExercises(sortExercises(loadedExercises));
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
  }, []);

  const persistExercises = useCallback(async (nextExercises: Exercise[]) => {
    const sortedExercises = sortExercises(nextExercises);
    setExercises(sortedExercises);
    await saveExercises(sortedExercises);
  }, []);

  const saveExercise = useCallback(
    async (exercise: Exercise) => {
      const now = new Date().toISOString();
      const existing = exercises.find((item) => item.id === exercise.id);
      const normalizedExercise: Exercise = {
        ...exercise,
        name: exercise.name.trim(),
        notes: exercise.notes?.trim() || undefined,
        createdAt: existing?.createdAt ?? exercise.createdAt ?? now,
        updatedAt: now,
      };

      const nextExercises = existing
        ? exercises.map((item) => (item.id === normalizedExercise.id ? normalizedExercise : item))
        : [...exercises, normalizedExercise];

      await persistExercises(nextExercises);
    },
    [exercises, persistExercises],
  );

  const deleteExercise = useCallback(
    async (exerciseId: string) => {
      await persistExercises(exercises.filter((exercise) => exercise.id !== exerciseId));
    },
    [exercises, persistExercises],
  );

  return {
    exercises,
    isLoading,
    saveExercise,
    deleteExercise,
  };
}
