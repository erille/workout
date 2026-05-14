import { Save, Volume1, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { Language } from "../../i18n/translations";
import type { AppSettings, NotificationMode, VoiceProvider } from "../../models/settings";
import { isAudioCueSupported, playAudioCue } from "../../services/audioCueService";
import {
  getServerTtsStatus,
  getSpeechVoices,
  isSpeechSupported,
  speak,
  type ServerTtsStatus,
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

function notificationIcon(mode: NotificationMode) {
  if (mode === "off") {
    return <VolumeX aria-hidden="true" size={22} />;
  }

  if (mode === "beep") {
    return <Volume1 aria-hidden="true" size={22} />;
  }

  return <Volume2 aria-hidden="true" size={22} />;
}

export function SettingsPage({ onSaveSettings, settings }: SettingsPageProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<ServerTtsStatus | null | undefined>(undefined);
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const speechSupported = isSpeechSupported();
  const audioCueSupported = isAudioCueSupported();
  const hasFrenchVoice = voices.some((voice) => voice.lang.toLowerCase().startsWith("fr"));
  const isVoiceMode = draft.notificationMode === "voice";
  const isBeepMode = draft.notificationMode === "beep";
  const isBrowserVoiceProvider = draft.voiceProvider === "browser";
  const isPiperVoiceProvider = draft.voiceProvider === "piper";
  const piperVoice = ttsStatus?.voices.find((voice) => voice.language === draft.language);

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

  useEffect(() => {
    let isMounted = true;

    getServerTtsStatus()
      .then((status) => {
        if (isMounted) {
          setTtsStatus(status);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTtsStatus(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSaveSettings(draft);
    setMessage(t("settings.saved"));
  };

  const updateDraft = (partial: Partial<AppSettings>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setMessage(null);
  };

  const updateNotificationMode = (notificationMode: NotificationMode) => {
    updateDraft({
      notificationMode,
      voiceEnabled: notificationMode === "voice",
    });
  };

  const notificationOptions: Array<{
    mode: NotificationMode;
    label: string;
    disabled: boolean;
  }> = [
    { mode: "voice", label: t("settings.modeVoice"), disabled: false },
    { mode: "beep", label: t("settings.modeBeeps"), disabled: !audioCueSupported },
    { mode: "off", label: t("settings.modeOff"), disabled: false },
  ];
  const voiceProviderOptions: Array<{
    value: VoiceProvider;
    label: string;
  }> = [
    { value: "piper", label: t("settings.providerPiper") },
    { value: "browser", label: t("settings.providerBrowser") },
  ];
  const piperStatusText =
    ttsStatus === undefined
      ? t("settings.piperChecking")
      : ttsStatus === null
        ? t("settings.piperUnavailable")
        : piperVoice?.available
          ? t("settings.piperAvailable")
          : t("settings.piperUnavailable");
  const audioStatusText =
    draft.notificationMode === "off"
      ? t("settings.audioOff")
      : isBeepMode
        ? audioCueSupported
          ? t("settings.beepsAvailable")
          : t("settings.beepsUnavailable")
        : isPiperVoiceProvider
          ? piperStatusText
          : speechSupported
            ? t("settings.speechAvailable")
            : t("settings.speechUnavailable");

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="label">{t("settings.section")}</p>
        <h2 className="text-2xl font-bold text-slate-50">{t("settings.title")}</h2>
      </div>

      <form className="panel space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-800 text-cyan-200">
                {notificationIcon(draft.notificationMode)}
              </div>
              <div>
                <h3 className="font-bold text-slate-50">{t("settings.audioMode")}</h3>
                <p className="text-sm text-slate-400">{audioStatusText}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:w-72">
              {notificationOptions.map((option) => {
                const isSelected = draft.notificationMode === option.mode;

                return (
                  <button
                    key={option.mode}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                    disabled={option.disabled}
                    aria-pressed={isSelected}
                    onClick={() => updateNotificationMode(option.mode)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="label">{t("settings.language")}</span>
          <select
            className="field"
            value={draft.language}
            onChange={(event) =>
              updateDraft({
                language: event.target.value as Language,
                voiceURI: undefined,
              })
            }
          >
            <option value="en">{t("settings.languageEnglish")}</option>
            <option value="fr">{t("settings.languageFrench")}</option>
          </select>
        </label>

        {isVoiceMode ? (
          <label className="block space-y-2">
            <span className="label">{t("settings.voiceProvider")}</span>
            <select
              className="field"
              value={draft.voiceProvider}
              onChange={(event) =>
                updateDraft({
                  voiceProvider: event.target.value as VoiceProvider,
                })
              }
            >
              {voiceProviderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-slate-400">
              {isPiperVoiceProvider ? piperStatusText : t("settings.browserVoiceHelp")}
            </p>
          </label>
        ) : null}

        {isVoiceMode && isBrowserVoiceProvider ? (
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
            {draft.language === "fr" && voices.length > 0 && !hasFrenchVoice ? (
              <p className="text-sm text-amber-200">{t("settings.noFrenchVoice")}</p>
            ) : null}
          </label>
        ) : null}

        {isVoiceMode && isBrowserVoiceProvider ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="space-y-3">
              <span className="label">
                {t("settings.rate", { value: numberValue(draft.voiceRate) })}
              </span>
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
              <span className="label">
                {t("settings.pitch", { value: numberValue(draft.voicePitch) })}
              </span>
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
              <span className="label">
                {t("settings.volume", { value: numberValue(draft.voiceVolume) })}
              </span>
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
        ) : null}

        {isBeepMode || (isVoiceMode && isPiperVoiceProvider) ? (
          <label className="block space-y-3">
            <span className="label">
              {t("settings.volume", { value: numberValue(draft.voiceVolume) })}
            </span>
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
        ) : null}

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
          {isVoiceMode ? (
            <button
              type="button"
              className="secondary-button"
              disabled={isBrowserVoiceProvider && !speechSupported}
              onClick={() =>
                speak(t("settings.previewText"), {
                  voiceProvider: draft.voiceProvider,
                  voiceURI: draft.voiceURI,
                  language: draft.language,
                  rate: draft.voiceRate,
                  pitch: draft.voicePitch,
                  volume: draft.voiceVolume,
                })
              }
            >
              <Volume2 aria-hidden="true" size={17} />
              {t("settings.previewVoice")}
            </button>
          ) : null}
          {isBeepMode ? (
            <>
              <button
                type="button"
                className="secondary-button"
                disabled={!audioCueSupported}
                onClick={() => playAudioCue("work", draft.voiceVolume)}
              >
                <Volume1 aria-hidden="true" size={17} />
                {t("settings.previewWorkBeep")}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!audioCueSupported}
                onClick={() => playAudioCue("rest", draft.voiceVolume)}
              >
                <Volume1 aria-hidden="true" size={17} />
                {t("settings.previewRestBeep")}
              </button>
            </>
          ) : null}
        </div>
      </form>
    </section>
  );
}
