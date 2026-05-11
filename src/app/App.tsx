import { useMemo, useState } from "react";
import { ExerciseLibrary } from "../components/exercises/ExerciseLibrary";
import { WorkoutHistory } from "../components/history/WorkoutHistory";
import { Navigation, type PageId } from "../components/layout/Navigation";
import { SettingsPage } from "../components/settings/Settings";
import { ActiveWorkout } from "../components/timer/ActiveWorkout";
import { WorkoutBuilder } from "../components/workout-builder/WorkoutBuilder";
import { useExercises } from "../hooks/useExercises";
import { useSessions } from "../hooks/useSessions";
import { useSettings } from "../hooks/useSettings";
import { useWorkoutPlans } from "../hooks/useWorkoutPlans";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("exercises");
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const { exercises, isLoading: exercisesLoading, saveExercise, deleteExercise } = useExercises();
  const { plans, isLoading: plansLoading, savePlan, deletePlan } = useWorkoutPlans();
  const { sessions, isLoading: sessionsLoading, addSession, deleteSession } = useSessions();
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings();

  const isLoading = exercisesLoading || plansLoading || sessionsLoading || settingsLoading;

  const activePlanFromStore = useMemo(() => {
    if (!activePlan) {
      return null;
    }

    return plans.find((plan) => plan.id === activePlan.id) ?? activePlan;
  }, [activePlan, plans]);

  const handleStartPlan = (plan: WorkoutPlan) => {
    setActivePlan(plan);
    setCurrentPage("timer");
  };

  const handleSessionComplete = async (session: WorkoutSession) => {
    await addSession(session);
  };

  return (
    <div className="min-h-screen">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="panel p-6 text-slate-300">Loading workout data...</div>
        ) : (
          <>
            {currentPage === "exercises" && (
              <ExerciseLibrary
                exercises={exercises}
                onDeleteExercise={deleteExercise}
                onSaveExercise={saveExercise}
              />
            )}
            {currentPage === "builder" && (
              <WorkoutBuilder
                exercises={exercises}
                plans={plans}
                onDeletePlan={deletePlan}
                onSavePlan={savePlan}
                onStartPlan={handleStartPlan}
              />
            )}
            {currentPage === "timer" && (
              <ActiveWorkout
                plan={activePlanFromStore}
                plans={plans}
                settings={settings}
                onSelectPlan={setActivePlan}
                onSessionComplete={handleSessionComplete}
              />
            )}
            {currentPage === "history" && (
              <WorkoutHistory sessions={sessions} onDeleteSession={deleteSession} />
            )}
            {currentPage === "settings" && (
              <SettingsPage settings={settings} onSaveSettings={updateSettings} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
