import { createContext, type ReactNode, useContext, useMemo } from "react";
import { translations, type Language, type TranslationKey } from "./translations";

type TranslationValues = Record<string, string | number>;

type I18nContextValue = {
  language: Language;
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  t: (key) => translations.en[key] ?? key,
});

export function translate(
  language: Language,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const template = translations[language][key] ?? translations.en[key] ?? key;

  if (!values) {
    return template;
  }

  return Object.entries(values).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template,
  );
}

export function I18nProvider({
  children,
  language,
}: {
  children: ReactNode;
  language: Language;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      t: (key, values) => translate(language, key, values),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
