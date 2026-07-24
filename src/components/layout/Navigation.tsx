import {
  Dumbbell,
  Globe2,
  History,
  House,
  Info,
  Library,
  ListChecks,
  LogIn,
  LogOut,
  BarChart3,
  MessageCircle,
  Settings,
  Timer,
  UserRound,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Language, TranslationKey } from "../../i18n/translations";
import { useI18n } from "../../i18n/I18nContext";
import type { StorageMode } from "../../data/storage";
import { MusicPlayer } from "../music/MusicPlayer";

export type PageId =
  | "home"
  | "exercises"
  | "builder"
  | "timer"
  | "history"
  | "statistics"
  | "character"
  | "coach"
  | "settings";

type NavigationProps = Readonly<{
  authEnabled: boolean;
  currentUserLogin?: string;
  currentPage: PageId;
  isAuthenticated: boolean;
  language: Language;
  storageMode: StorageMode;
  onLanguageToggle: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onNavigate: (page: PageId) => void;
}>;

const navItems = [
  { id: "home", labelKey: "nav.home", icon: House },
  { id: "exercises", labelKey: "nav.exercises", icon: Library },
  { id: "builder", labelKey: "nav.builder", icon: ListChecks },
  { id: "coach", labelKey: "nav.coach", icon: MessageCircle },
  { id: "timer", labelKey: "nav.timer", icon: Timer },
  { id: "history", labelKey: "nav.history", icon: History },
  { id: "statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { id: "character", labelKey: "nav.character", icon: UserRound },
] satisfies Array<{ id: PageId; labelKey: TranslationKey; icon: typeof Dumbbell }>;

export function Navigation({
  authEnabled,
  currentUserLogin,
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
  let modeLabel = t("auth.serverMode");
  if (storageMode === "local") {
    modeLabel = t("auth.localMode");
  } else if (authEnabled) {
    modeLabel = t("auth.privateMode");
  }
  const visibleNavItems =
    storageMode === "server" ? navItems : navItems.filter((item) => item.id !== "coach");

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

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/90 bg-slate-950/88 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            className="flex items-center gap-3 rounded-md transition hover:opacity-90"
            href="/"
            aria-label={t("nav.home")}
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.altKey ||
                event.ctrlKey ||
                event.shiftKey
              ) {
                return;
              }

              event.preventDefault();
              onNavigate("home");
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
              <Dumbbell aria-hidden="true" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-50">Workout</h1>
              <p className="text-sm text-slate-400">{t("nav.subtitle")}</p>
            </div>
          </a>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-300">
              {currentUserLogin ? `${modeLabel} · ${currentUserLogin}` : modeLabel}
            </span>
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
                  {"This site uses "}
                  <a
                    className="font-semibold text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline"
                    href="https://github.com/erille/workout"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Workout
                  </a>
                  {", a project by Ketah."}
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
            <button
              type="button"
              className={`${currentPage === "settings" ? "primary-button" : "secondary-button"} px-3`}
              onClick={() => onNavigate("settings")}
            >
              <Settings aria-hidden="true" size={17} />
              {t("nav.settings")}
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
        <nav
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          aria-label={t("nav.aria")}
        >
          {visibleNavItems.map(({ id, labelKey, icon: Icon }) => {
            const isActive = currentPage === id;

            return (
              <Fragment key={id}>
                <button
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
                {id === "character" ? <MusicPlayer enabled={storageMode === "server"} /> : null}
              </Fragment>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
