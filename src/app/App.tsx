import { useMemo, useState } from "react";
import { LoginPage } from "../components/auth/LoginPage";
import { ExerciseLibrary } from "../components/exercises/ExerciseLibrary";
import { WorkoutHistory } from "../components/history/WorkoutHistory";
import { Navigation, type PageId } from "../components/layout/Navigation";
import { SettingsPage } from "../components/settings/Settings";
import { ActiveWorkout } from "../components/timer/ActiveWorkout";
import { WorkoutBuilder } from "../components/workout-builder/WorkoutBuilder";
import { useExercises } from "../hooks/useExercises";
import { useAuth } from "../hooks/useAuth";
import { useSessions } from "../hooks/useSessions";
import { useSettings } from "../hooks/useSettings";
import { useWorkoutPlans } from "../hooks/useWorkoutPlans";
import { I18nProvider, translate } from "../i18n/I18nContext";
import type { Language } from "../i18n/translations";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("exercises");
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [loginLanguage, setLoginLanguage] = useState<Language>(() =>
    typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("fr")
      ? "fr"
      : "en",
  );
  const { status: authStatus, isLoading: authLoading, login, logout } = useAuth();
  const canLoadData = !authLoading && (!authStatus.authEnabled || authStatus.authenticated);
  const { exercises, isLoading: exercisesLoading, saveExercise, deleteExercise } =
    useExercises(canLoadData);
  const { plans, isLoading: plansLoading, savePlan, deletePlan } = useWorkoutPlans(canLoadData);
  const { sessions, isLoading: sessionsLoading, addSession, deleteSession } = useSessions(canLoadData);
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings(canLoadData);

  const language = canLoadData ? settings.language : loginLanguage;
  const isLoading =
    authLoading || (canLoadData && (exercisesLoading || plansLoading || sessionsLoading || settingsLoading));
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(language, key, values);

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

  const toggleLanguage = () => {
    if (!canLoadData) {
      setLoginLanguage((current) => (current === "fr" ? "en" : "fr"));
      return;
    }

    void updateSettings({
      ...settings,
      language: settings.language === "fr" ? "en" : "fr",
      voiceURI: undefined,
    });
  };

  return (
    <I18nProvider language={language}>
      <div className="min-h-screen">
        {isLoading ? (
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="panel p-6 text-slate-300">{t("app.loading")}</div>
          </main>
        ) : authStatus.authEnabled && !authStatus.authenticated ? (
          <LoginPage language={language} onLanguageToggle={toggleLanguage} onLogin={login} />
        ) : (
          <>
            <Navigation
              authEnabled={authStatus.authEnabled}
              currentPage={currentPage}
              language={language}
              onLanguageToggle={toggleLanguage}
              onLogout={() => {
                void logout();
              }}
              onNavigate={setCurrentPage}
            />
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
            </main>
          </>
        )}
      </div>
    </I18nProvider>
  );
}
