import { Dumbbell, Globe2, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { Language } from "../../i18n/translations";

type LoginPageProps = {
  language: Language;
  onLanguageToggle: () => void;
  onLogin: (password: string) => Promise<void>;
};

export function LoginPage({ language, onLanguageToggle, onLogin }: LoginPageProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onLogin(password);
    } catch (loginError) {
      setError(
        loginError instanceof Error && loginError.message === "401"
          ? t("auth.invalid")
          : t("auth.error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
              <Dumbbell aria-hidden="true" size={23} />
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

        <form className="panel space-y-5 p-5" onSubmit={handleSubmit}>
          <div>
            <p className="label">{t("auth.title")}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-50">{t("auth.subtitle")}</h2>
          </div>

          <label className="block space-y-2">
            <span className="label">{t("auth.password")}</span>
            <input
              className="field text-base"
              autoComplete="current-password"
              autoFocus
              placeholder={t("auth.passwordPlaceholder")}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? (
            <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <button type="submit" className="primary-button w-full min-h-12" disabled={isSubmitting}>
            <LogIn aria-hidden="true" size={18} />
            {t("auth.login")}
          </button>
        </form>
      </section>
    </main>
  );
}
