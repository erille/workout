import { useEffect, useMemo, useState } from "react";
import { LoginPage } from "../components/auth/LoginPage";
import { CharacterSheet } from "../components/character/CharacterSheet";
import { ExerciseLibrary } from "../components/exercises/ExerciseLibrary";
import { WorkoutHistory } from "../components/history/WorkoutHistory";
import { Navigation, type PageId } from "../components/layout/Navigation";
import { SettingsPage } from "../components/settings/Settings";
import { ActiveWorkout } from "../components/timer/ActiveWorkout";
import { WorkoutBuilder } from "../components/workout-builder/WorkoutBuilder";
import { useExercises } from "../hooks/useExercises";
import { useAuth } from "../hooks/useAuth";
import { useSessions } from "../hooks/useSessions";
import { useProfile } from "../hooks/useProfile";
import { useSettings } from "../hooks/useSettings";
import { useWorkoutPlans } from "../hooks/useWorkoutPlans";
import { I18nProvider, translate } from "../i18n/I18nContext";
import type { StorageMode } from "../data/storage";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("exercises");
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { status: authStatus, isLoading: authLoading, login, logout } = useAuth();
  const storageMode: StorageMode =
    !authStatus.apiAvailable || (authStatus.authEnabled && !authStatus.authenticated)
      ? "local"
      : "server";
  const canLoadData = !authLoading;
  const { exercises, isLoading: exercisesLoading, saveExercise, deleteExercise } =
    useExercises(storageMode, canLoadData);
  const { plans, isLoading: plansLoading, savePlan, deletePlan } = useWorkoutPlans(
    storageMode,
    canLoadData,
  );
  const { sessions, isLoading: sessionsLoading, addSession, deleteSession } = useSessions(
    storageMode,
    canLoadData,
  );
  const { profile, isLoading: profileLoading, updateProfile } = useProfile(
    storageMode,
    canLoadData,
  );
  const { settings, isLoading: settingsLoading, updateSettings } = useSettings(
    storageMode,
    canLoadData,
  );

  const language = settings.language;
  const isLoading =
    authLoading ||
    exercisesLoading ||
    plansLoading ||
    sessionsLoading ||
    profileLoading ||
    settingsLoading;
  const t = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
    translate(language, key, values);

  useEffect(() => {
    setActivePlan(null);
  }, [storageMode]);

  useEffect(() => {
    if (!authStatus.authEnabled || authStatus.authenticated) {
      setIsLoginOpen(false);
    }
  }, [authStatus.authEnabled, authStatus.authenticated]);

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
    void updateSettings({
      ...settings,
      language: settings.language === "fr" ? "en" : "fr",
    });
  };

  const handleLogin = async (password: string) => {
    await login(password);
    setIsLoginOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setActivePlan(null);
  };

  return (
    <I18nProvider language={language}>
      <div className="min-h-screen">
        {isLoading ? (
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="panel p-6 text-slate-300">{t("app.loading")}</div>
          </main>
        ) : (
          <>
            <Navigation
              authEnabled={authStatus.authEnabled}
              currentPage={currentPage}
              isAuthenticated={authStatus.authenticated}
              language={language}
              storageMode={storageMode}
              onLanguageToggle={toggleLanguage}
              onLogin={() => setIsLoginOpen(true)}
              onLogout={() => {
                void handleLogout();
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
                <WorkoutHistory
                  exercises={exercises}
                  sessions={sessions}
                  onDeleteSession={deleteSession}
                  onSaveSession={addSession}
                />
              )}
              {currentPage === "character" && (
                <CharacterSheet profile={profile} onSaveProfile={updateProfile} />
              )}
              {currentPage === "settings" && (
                <SettingsPage settings={settings} onSaveSettings={updateSettings} />
              )}
            </main>
            {isLoginOpen ? (
              <LoginPage onCancel={() => setIsLoginOpen(false)} onLogin={handleLogin} />
            ) : null}
          </>
        )}
      </div>
    </I18nProvider>
  );
}
