import {
  Dumbbell,
  Download,
  Globe2,
  History,
  Info,
  Library,
  ListChecks,
  LogIn,
  LogOut,
  BarChart3,
  Settings,
  Timer,
  Upload,
  UserRound,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import type { Language } from "../../i18n/translations";
import type { TranslationKey } from "../../i18n/translations";
import { useI18n } from "../../i18n/I18nContext";
import { exportLocalData, importLocalData, type StorageMode } from "../../data/storage";

export type PageId =
  | "exercises"
  | "builder"
  | "timer"
  | "history"
  | "statistics"
  | "character"
  | "settings";

type NavigationProps = {
  authEnabled: boolean;
  currentPage: PageId;
  isAuthenticated: boolean;
  language: Language;
  storageMode: StorageMode;
  onLanguageToggle: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onNavigate: (page: PageId) => void;
};

const navItems = [
  { id: "exercises", labelKey: "nav.exercises", icon: Library },
  { id: "builder", labelKey: "nav.builder", icon: ListChecks },
  { id: "timer", labelKey: "nav.timer", icon: Timer },
  { id: "history", labelKey: "nav.history", icon: History },
  { id: "statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { id: "character", labelKey: "nav.character", icon: UserRound },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
] satisfies Array<{ id: PageId; labelKey: TranslationKey; icon: typeof Dumbbell }>;

export function Navigation({
  authEnabled,
  currentPage,
  isAuthenticated,
  language,
  storageMode,
  onLanguageToggle,
  onLogin,
  onLogout,
  onNavigate,
}: NavigationProps) {
  const { t } = useI18n();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const modeLabel =
    storageMode === "local"
      ? t("auth.localMode")
      : authEnabled
        ? t("auth.privateMode")
        : t("auth.serverMode");

  useEffect(() => {
    if (!isAboutOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!aboutRef.current?.contains(event.target as Node)) {
        setIsAboutOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAboutOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAboutOpen]);

  const handleExportLocalData = async () => {
    const exportData = await exportLocalData();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `workout-backup-${dateStamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLocalData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!window.confirm(t("localData.importConfirm"))) {
      return;
    }

    try {
      const text = await file.text();
      await importLocalData(JSON.parse(text));
      window.alert(t("localData.importSuccess"));
      window.location.reload();
    } catch {
      window.alert(t("localData.importError"));
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/90 bg-slate-950/88 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
              <Dumbbell aria-hidden="true" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-50">Workout</h1>
              <p className="text-sm text-slate-400">{t("nav.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-300">
              {modeLabel}
            </span>
            {storageMode === "local" ? (
              <>
                <button
                  type="button"
                  className="secondary-button px-3"
                  onClick={() => {
                    void handleExportLocalData();
                  }}
                >
                  <Download aria-hidden="true" size={17} />
                  {t("localData.export")}
                </button>
                <button
                  type="button"
                  className="secondary-button px-3"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload aria-hidden="true" size={17} />
                  {t("localData.import")}
                </button>
                <input
                  ref={importInputRef}
                  className="hidden"
                  accept="application/json,.json"
                  type="file"
                  onChange={(event) => {
                    void handleImportLocalData(event);
                  }}
                />
              </>
            ) : null}
            <div ref={aboutRef} className="relative">
              <button
                type="button"
                className="secondary-button px-3"
                aria-controls="about-popover"
                aria-expanded={isAboutOpen}
                onClick={() => setIsAboutOpen((current) => !current)}
              >
                <Info aria-hidden="true" size={17} />
                {t("common.about")}
              </button>
              {isAboutOpen ? (
                <div
                  id="about-popover"
                  className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300 shadow-2xl"
                >
                  <span className="absolute -top-1 right-6 h-2 w-2 rotate-45 border-l border-t border-slate-700 bg-slate-900" />
                  This site uses{" "}
                  <a
                    className="font-semibold text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline"
                    href="https://github.com/erille/workout"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Workout
                  </a>
                  , a project by Ketah.
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="secondary-button px-3"
              aria-label={t("nav.languageToggle")}
              onClick={onLanguageToggle}
            >
              <Globe2 aria-hidden="true" size={17} />
              {language.toUpperCase()}
            </button>
            {authEnabled && isAuthenticated ? (
              <button type="button" className="secondary-button px-3" onClick={onLogout}>
                <LogOut aria-hidden="true" size={17} />
                {t("common.logout")}
              </button>
            ) : null}
            {authEnabled && !isAuthenticated ? (
              <button type="button" className="primary-button px-3" onClick={onLogin}>
                <LogIn aria-hidden="true" size={17} />
                {t("auth.login")}
              </button>
            ) : null}
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t("nav.aria")}>
          {navItems.map(({ id, labelKey, icon: Icon }) => {
            const isActive = currentPage === id;

            return (
              <button
                key={id}
                type="button"
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-50"
                }`}
                onClick={() => onNavigate(id)}
              >
                <Icon aria-hidden="true" size={18} />
                {t(labelKey)}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
