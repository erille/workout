import { useCallback, useEffect, useState } from "react";
import { getSessions, saveSessions, type StorageMode } from "../data/storage";
import type { WorkoutSession } from "../models/session";

function sortSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function useSessions(mode: StorageMode, enabled = true) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loadedMode, setLoadedMode] = useState<StorageMode | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getSessions(mode)
      .then((loadedSessions) => {
        if (isMounted) {
          setSessions(sortSessions(loadedSessions));
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

  const visibleSessions = loadedMode === mode ? sessions : [];

  const persistSessions = useCallback(async (nextSessions: WorkoutSession[]) => {
    const sortedSessions = sortSessions(nextSessions);
    setSessions(sortedSessions);
    setLoadedMode(mode);
    await saveSessions(sortedSessions, mode);
  }, [mode]);

  const addSession = useCallback(
    async (session: WorkoutSession) => {
      await persistSessions([session, ...visibleSessions.filter((item) => item.id !== session.id)]);
    },
    [persistSessions, visibleSessions],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await persistSessions(visibleSessions.filter((session) => session.id !== sessionId));
    },
    [persistSessions, visibleSessions],
  );

  return {
    sessions: visibleSessions,
    isLoading: enabled && (isLoading || loadedMode !== mode),
    addSession,
    deleteSession,
  };
}
