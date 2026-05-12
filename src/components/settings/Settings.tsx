import { Save, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { Language } from "../../i18n/translations";
import type { AppSettings } from "../../models/settings";
import {
  getSpeechVoices,
  isSpeechSupported,
  speak,
  type SpeechVoiceOption,
} from "../../services/speechService";

type SettingsPageProps = {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
};

function numberValue(value: number): string {
  return value.toFixed(1);
}

function voiceLabel(
  voice: SpeechVoiceOption,
  labels: { defaultLabel: string; local: string; remote: string },
): string {
  const source = voice.localService ? labels.local : labels.remote;
  const defaultLabel = voice.default ? `, ${labels.defaultLabel}` : "";

  return `${voice.name} (${voice.lang}, ${source}${defaultLabel})`;
}

export function SettingsPage({ onSaveSettings, settings }: SettingsPageProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const speechSupported = isSpeechSupported();

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!speechSupported) {
      setVoices([]);
      return undefined;
    }

    const refreshVoices = () => {
      setVoices(getSpeechVoices());
    };

    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [speechSupported]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSaveSettings(draft);
    setMessage(t("settings.saved"));
  };

  const updateDraft = (partial: Partial<AppSettings>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setMessage(null);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="label">{t("settings.section")}</p>
        <h2 className="text-2xl font-bold text-slate-50">{t("settings.title")}</h2>
      </div>

      <form className="panel space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-800 text-cyan-200">
              {draft.voiceEnabled ? (
                <Volume2 aria-hidden="true" size={22} />
              ) : (
                <VolumeX aria-hidden="true" size={22} />
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-50">{t("settings.trainerVoice")}</h3>
              <p className="text-sm text-slate-400">
                {speechSupported ? t("settings.speechAvailable") : t("settings.speechUnavailable")}
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">
              {draft.voiceEnabled ? t("settings.on") : t("settings.off")}
            </span>
            <input
              className="h-5 w-5 accent-cyan-300"
              type="checkbox"
              checked={draft.voiceEnabled}
              onChange={(event) => updateDraft({ voiceEnabled: event.target.checked })}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="label">{t("settings.language")}</span>
          <select
            className="field"
            value={draft.language}
            onChange={(event) => updateDraft({ language: event.target.value as Language })}
          >
            <option value="en">{t("settings.languageEnglish")}</option>
            <option value="fr">{t("settings.languageFrench")}</option>
          </select>
        </label>

        <label className="block space-y-2">
          <span className="label">{t("settings.voice")}</span>
          <select
            className="field"
            disabled={!speechSupported || voices.length === 0}
            value={draft.voiceURI ?? ""}
            onChange={(event) =>
              updateDraft({
                voiceURI: event.target.value === "" ? undefined : event.target.value,
              })
            }
          >
            <option value="">{t("settings.systemDefault")}</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voiceLabel(voice, {
                  defaultLabel: t("common.default"),
                  local: t("common.local"),
                  remote: t("common.remote"),
                })}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-400">
            {voices.length > 0
              ? t("settings.voicesAvailable", {
                  count: voices.length,
                  plural: voices.length === 1 ? "" : "s",
                })
              : t("settings.noVoices")}
          </p>
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="space-y-3">
            <span className="label">{t("settings.rate", { value: numberValue(draft.voiceRate) })}</span>
            <input
              className="w-full accent-cyan-300"
              min={0.5}
              max={2}
              step={0.1}
              type="range"
              value={draft.voiceRate}
              onChange={(event) => updateDraft({ voiceRate: Number(event.target.value) })}
            />
          </label>
          <label className="space-y-3">
            <span className="label">{t("settings.pitch", { value: numberValue(draft.voicePitch) })}</span>
            <input
              className="w-full accent-cyan-300"
              min={0}
              max={2}
              step={0.1}
              type="range"
              value={draft.voicePitch}
              onChange={(event) => updateDraft({ voicePitch: Number(event.target.value) })}
            />
          </label>
          <label className="space-y-3">
            <span className="label">{t("settings.volume", { value: numberValue(draft.voiceVolume) })}</span>
            <input
              className="w-full accent-cyan-300"
              min={0}
              max={1}
              step={0.1}
              type="range"
              value={draft.voiceVolume}
              onChange={(event) => updateDraft({ voiceVolume: Number(event.target.value) })}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="label">{t("settings.theme")}</span>
          <select
            className="field"
            value={draft.theme}
            onChange={(event) =>
              updateDraft({ theme: event.target.value as AppSettings["theme"] })
            }
          >
            <option value="dark">{t("settings.dark")}</option>
            <option value="light">{t("settings.light")}</option>
          </select>
        </label>

        {message ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="submit" className="primary-button">
            <Save aria-hidden="true" size={17} />
            {t("settings.save")}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!speechSupported || !draft.voiceEnabled}
            onClick={() =>
              speak(t("settings.previewText"), {
                voiceURI: draft.voiceURI,
                rate: draft.voiceRate,
                pitch: draft.voicePitch,
                volume: draft.voiceVolume,
              })
            }
          >
            <Volume2 aria-hidden="true" size={17} />
            {t("settings.previewVoice")}
          </button>
        </div>
      </form>
    </section>
  );
}
