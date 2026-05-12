import { useCallback, useEffect, useState } from "react";
import { getExercises, saveExercises, type StorageMode } from "../data/storage";
import type { Exercise } from "../models/exercise";

function sortExercises(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
}

export function useExercises(mode: StorageMode, enabled = true) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadedMode, setLoadedMode] = useState<StorageMode | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getExercises(mode)
      .then((loadedExercises) => {
        if (isMounted) {
          setExercises(sortExercises(loadedExercises));
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

  const visibleExercises = loadedMode === mode ? exercises : [];

  const persistExercises = useCallback(async (nextExercises: Exercise[]) => {
    const sortedExercises = sortExercises(nextExercises);
    setExercises(sortedExercises);
    setLoadedMode(mode);
    await saveExercises(sortedExercises, mode);
  }, [mode]);

  const saveExercise = useCallback(
    async (exercise: Exercise) => {
      const now = new Date().toISOString();
      const existing = visibleExercises.find((item) => item.id === exercise.id);
      const normalizedExercise: Exercise = {
        ...exercise,
        name: exercise.name.trim(),
        notes: exercise.notes?.trim() || undefined,
        createdAt: existing?.createdAt ?? exercise.createdAt ?? now,
        updatedAt: now,
      };

      const nextExercises = existing
        ? visibleExercises.map((item) => (item.id === normalizedExercise.id ? normalizedExercise : item))
        : [...visibleExercises, normalizedExercise];

      await persistExercises(nextExercises);
    },
    [persistExercises, visibleExercises],
  );

  const deleteExercise = useCallback(
    async (exerciseId: string) => {
      await persistExercises(visibleExercises.filter((exercise) => exercise.id !== exerciseId));
    },
    [persistExercises, visibleExercises],
  );

  return {
    exercises: visibleExercises,
    isLoading: enabled && (isLoading || loadedMode !== mode),
    saveExercise,
    deleteExercise,
  };
}
