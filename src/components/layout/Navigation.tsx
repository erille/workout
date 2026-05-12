import {
  Dumbbell,
  Globe2,
  History,
  Library,
  ListChecks,
  Settings,
  Timer,
} from "lucide-react";
import type { Language } from "../../i18n/translations";
import type { TranslationKey } from "../../i18n/translations";
import { useI18n } from "../../i18n/I18nContext";

export type PageId = "exercises" | "builder" | "timer" | "history" | "settings";

type NavigationProps = {
  currentPage: PageId;
  language: Language;
  onLanguageToggle: () => void;
  onNavigate: (page: PageId) => void;
};

const navItems = [
  { id: "exercises", labelKey: "nav.exercises", icon: Library },
  { id: "builder", labelKey: "nav.builder", icon: ListChecks },
  { id: "timer", labelKey: "nav.timer", icon: Timer },
  { id: "history", labelKey: "nav.history", icon: History },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
] satisfies Array<{ id: PageId; labelKey: TranslationKey; icon: typeof Dumbbell }>;

export function Navigation({
  currentPage,
  language,
  onLanguageToggle,
  onNavigate,
}: NavigationProps) {
  const { t } = useI18n();

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
          <button
            type="button"
            className="secondary-button px-3"
            aria-label={t("nav.languageToggle")}
            onClick={onLanguageToggle}
          >
            <Globe2 aria-hidden="true" size={17} />
            {language.toUpperCase()}
          </button>
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
