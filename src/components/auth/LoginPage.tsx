import { LogIn, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";

type LoginPageProps = {
  onCancel: () => void;
  onLogin: (password: string) => Promise<void>;
};

export function LoginPage({ onCancel, onLogin }: LoginPageProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur">
      <form className="panel w-full max-w-md space-y-5 p-5 shadow-2xl" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label">{t("auth.title")}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-50">{t("auth.subtitle")}</h2>
          </div>
          <button
            type="button"
            className="secondary-button h-10 w-10 justify-center px-0"
            aria-label={t("common.cancel")}
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
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

        <button type="submit" className="primary-button min-h-12 w-full" disabled={isSubmitting}>
          <LogIn aria-hidden="true" size={18} />
          {t("auth.login")}
        </button>
      </form>
    </div>
  );
}
