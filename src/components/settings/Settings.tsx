import { Save, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
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

function voiceLabel(voice: SpeechVoiceOption): string {
  const source = voice.localService ? "local" : "remote";
  const defaultLabel = voice.default ? ", default" : "";

  return `${voice.name} (${voice.lang}, ${source}${defaultLabel})`;
}

export function SettingsPage({ onSaveSettings, settings }: SettingsPageProps) {
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
    setMessage("Settings saved.");
  };

  const updateDraft = (partial: Partial<AppSettings>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setMessage(null);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="label">Settings</p>
        <h2 className="text-2xl font-bold text-slate-50">Voice announcements</h2>
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
              <h3 className="font-bold text-slate-50">Trainer voice</h3>
              <p className="text-sm text-slate-400">
                {speechSupported ? "Browser speech is available." : "Browser speech is unavailable."}
              </p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">
              {draft.voiceEnabled ? "On" : "Off"}
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
          <span className="label">Voice</span>
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
            <option value="">System default</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voiceLabel(voice)}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-400">
            {voices.length > 0
              ? `${voices.length} browser voice${voices.length === 1 ? "" : "s"} available.`
              : "No selectable browser voices loaded yet."}
          </p>
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="space-y-3">
            <span className="label">Rate · {numberValue(draft.voiceRate)}</span>
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
            <span className="label">Pitch · {numberValue(draft.voicePitch)}</span>
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
            <span className="label">Volume · {numberValue(draft.voiceVolume)}</span>
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
          <span className="label">Theme</span>
          <select
            className="field"
            value={draft.theme}
            onChange={(event) =>
              updateDraft({ theme: event.target.value as AppSettings["theme"] })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
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
            Save settings
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!speechSupported || !draft.voiceEnabled}
            onClick={() =>
              speak("Next, Push-up for 45 seconds.", {
                voiceURI: draft.voiceURI,
                rate: draft.voiceRate,
                pitch: draft.voicePitch,
                volume: draft.voiceVolume,
              })
            }
          >
            <Volume2 aria-hidden="true" size={17} />
            Preview voice
          </button>
        </div>
      </form>
    </section>
  );
}
