import { useCallback, useEffect, useState } from "react";
import { getSessions, saveSessions } from "../data/storage";
import type { WorkoutSession } from "../models/session";

function sortSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function useSessions(enabled = true) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getSessions()
      .then((loadedSessions) => {
        if (isMounted) {
          setSessions(sortSessions(loadedSessions));
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

  const persistSessions = useCallback(async (nextSessions: WorkoutSession[]) => {
    const sortedSessions = sortSessions(nextSessions);
    setSessions(sortedSessions);
    await saveSessions(sortedSessions);
  }, []);

  const addSession = useCallback(
    async (session: WorkoutSession) => {
      await persistSessions([session, ...sessions.filter((item) => item.id !== session.id)]);
    },
    [persistSessions, sessions],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await persistSessions(sessions.filter((session) => session.id !== sessionId));
    },
    [persistSessions, sessions],
  );

  return {
    sessions,
    isLoading,
    addSession,
    deleteSession,
  };
}
