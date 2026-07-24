import { useEffect, useMemo, useState } from "react";
import { LoginPage } from "../components/auth/LoginPage";
import { CharacterSheet } from "../components/character/CharacterSheet";
import { CoachPage } from "../components/coach/CoachPage";
import { ExerciseLibrary } from "../components/exercises/ExerciseLibrary";
import { WorkoutHistory } from "../components/history/WorkoutHistory";
import { HomeDashboard } from "../components/home/HomeDashboard";
import { Navigation, type PageId } from "../components/layout/Navigation";
import { SettingsPage } from "../components/settings/Settings";
import { StatisticsPage } from "../components/statistics/StatisticsPage";
import { ActiveWorkout } from "../components/timer/ActiveWorkout";
import { WorkoutBuilder } from "../components/workout-builder/WorkoutBuilder";
import { useExercises } from "../hooks/useExercises";
import { useAuth } from "../hooks/useAuth";
import { useSessions } from "../hooks/useSessions";
import { useProfile } from "../hooks/useProfile";
import { useSettings } from "../hooks/useSettings";
import { useWorkoutPlans } from "../hooks/useWorkoutPlans";
import { I18nProvider, translate } from "../i18n/I18nContext";
import { invalidateServerDataCache, type StorageMode } from "../data/storage";
import type { ExerciseCategoryDefinition } from "../models/exercise";
import type { WorkoutSession } from "../models/session";
import type { WorkoutPlan } from "../models/workout";

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [serverDataReloadKey, setServerDataReloadKey] = useState(0);
  const { status: authStatus, isLoading: authLoading, login, logout } = useAuth();
  const storageMode: StorageMode =
    !authStatus.apiAvailable || (authStatus.authEnabled && !authStatus.authenticated)
      ? "local"
      : "server";
  const canLoadData = !authLoading;
  const { exercises, isLoading: exercisesLoading, saveAllExercises, saveExercise, deleteExercise } =
    useExercises(storageMode, canLoadData, serverDataReloadKey);
  const { plans, isLoading: plansLoading, savePlan, deletePlan } = useWorkoutPlans(
    storageMode,
    canLoadData,
    serverDataReloadKey,
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
    serverDataReloadKey,
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
    if (storageMode === "local" && currentPage === "coach") {
      setCurrentPage("home");
    }
  }, [currentPage, storageMode]);

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
    updateSettings({
      ...settings,
      language: settings.language === "fr" ? "en" : "fr",
    }).catch(() => undefined);
  };

  const updateExerciseCategories = async (exerciseCategories: ExerciseCategoryDefinition[]) => {
    await updateSettings({
      ...settings,
      exerciseCategories,
    });
  };

  const handleLogin = async (loginName: string, password: string) => {
    invalidateServerDataCache();
    await login(loginName, password);
    setIsLoginOpen(false);
  };

  const handleLogout = async () => {
    invalidateServerDataCache();
    await logout();
    setActivePlan(null);
  };

  const handleCoachDataChanged = () => {
    invalidateServerDataCache();
    setServerDataReloadKey((current) => current + 1);
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
              currentUserLogin={authStatus.user?.login}
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
              {currentPage === "home" && (
                <HomeDashboard profile={profile} sessions={sessions} />
              )}
              {currentPage === "exercises" && (
                <ExerciseLibrary
                  categories={settings.exerciseCategories}
                  exercises={exercises}
                  onDeleteExercise={deleteExercise}
                  onSaveCategories={updateExerciseCategories}
                  onSaveExercise={saveExercise}
                  onSaveExercises={saveAllExercises}
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
                  plans={plans}
                  sessions={sessions}
                  onDeleteSession={deleteSession}
                  onSaveSession={addSession}
                />
              )}
              {currentPage === "statistics" && (
                <StatisticsPage
                  exercises={exercises}
                  profile={profile}
                  sessions={sessions}
                  settings={settings}
                />
              )}
              {currentPage === "character" && (
                <CharacterSheet profile={profile} onSaveProfile={updateProfile} />
              )}
              {currentPage === "coach" && storageMode === "server" && (
                <CoachPage onDataChanged={handleCoachDataChanged} />
              )}
              {currentPage === "settings" && (
                <SettingsPage
                  exercises={exercises}
                  settings={settings}
                  storageMode={storageMode}
                  onSaveSettings={updateSettings}
                />
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
