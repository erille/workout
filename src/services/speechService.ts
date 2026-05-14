import type { Language } from "../i18n/translations";
import type { VoiceProvider } from "../models/settings";

export type SpeakOptions = {
  voiceProvider?: VoiceProvider;
  voiceURI?: string;
  language?: Language;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export type SpeechVoiceOption = {
  default: boolean;
  lang: string;
  localService: boolean;
  name: string;
  voiceURI: string;
};

export type ServerTtsVoice = {
  id: string;
  language: Language;
  available: boolean;
  model: string;
};

export type ServerTtsStatus = {
  provider: "piper";
  available: boolean;
  voices: ServerTtsVoice[];
};

type ServerSpeechResponse = {
  url: string;
  cached: boolean;
  provider: "piper";
  voice: string;
};

let activeAudio: HTMLAudioElement | null = null;
let speechRequestId = 0;

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function speechLanguageCode(language?: Language): string {
  return language === "fr" ? "fr-FR" : "en-US";
}

function resolveVoice(options?: SpeakOptions): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();

  if (options?.voiceURI) {
    const selectedVoice = voices.find((voice) => voice.voiceURI === options.voiceURI);

    if (selectedVoice) {
      return selectedVoice;
    }
  }

  const targetLanguage = speechLanguageCode(options?.language).toLowerCase();
  const languagePrefix = targetLanguage.split("-")[0];

  return (
    voices.find((voice) => voice.lang.toLowerCase() === targetLanguage) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${languagePrefix}-`))
  );
}

function stopActiveAudio(): void {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();
  activeAudio.removeAttribute("src");
  activeAudio.load();
  activeAudio = null;
}

function cancelBrowserSpeech(): void {
  if (!isSpeechSupported()) {
    return;
  }

  window.speechSynthesis.cancel();
}

function playBrowserSpeech(text: string, options?: SpeakOptions): void {
  if (!isSpeechSupported()) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = resolveVoice(options);

  if (voice) {
    utterance.voice = voice;
  }

  utterance.lang = voice?.lang ?? speechLanguageCode(options?.language);
  utterance.rate = clamp(options?.rate, 0.5, 2, 1);
  utterance.pitch = clamp(options?.pitch, 0, 2, 1);
  utterance.volume = clamp(options?.volume, 0, 1, 1);

  window.speechSynthesis.speak(utterance);
}

async function requestServerSpeech(
  text: string,
  language: Language,
): Promise<ServerSpeechResponse> {
  const response = await fetch("/api/tts", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  return response.json() as Promise<ServerSpeechResponse>;
}

async function playServerSpeech(
  text: string,
  options: SpeakOptions | undefined,
  requestId: number,
): Promise<void> {
  const language = options?.language ?? "en";
  const serverSpeech = await requestServerSpeech(text, language);

  if (requestId !== speechRequestId) {
    return;
  }

  const audio = new Audio(serverSpeech.url);
  audio.volume = clamp(options?.volume, 0, 1, 1);
  activeAudio = audio;
  audio.addEventListener("ended", () => {
    if (activeAudio === audio) {
      activeAudio = null;
    }
  });
  await audio.play();
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function cancelSpeech(): void {
  speechRequestId += 1;
  stopActiveAudio();
  cancelBrowserSpeech();
}

export function getSpeechVoices(): SpeechVoiceOption[] {
  if (!isSpeechSupported()) {
    return [];
  }

  return window.speechSynthesis.getVoices().map((voice) => ({
    default: voice.default,
    lang: voice.lang,
    localService: voice.localService,
    name: voice.name,
    voiceURI: voice.voiceURI,
  }));
}

export async function getServerTtsStatus(): Promise<ServerTtsStatus> {
  const response = await fetch("/api/tts/status", {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`TTS status request failed: ${response.status}`);
  }

  return response.json() as Promise<ServerTtsStatus>;
}

export function prepareSpeech(texts: string[], options?: SpeakOptions): void {
  if (options?.voiceProvider !== "piper") {
    return;
  }

  const language = options.language ?? "en";
  const uniqueTexts = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];

  uniqueTexts.forEach((text) => {
    void requestServerSpeech(text, language).catch(() => undefined);
  });
}

export function speak(text: string, options?: SpeakOptions): void {
  const cleanText = text.trim();

  if (cleanText.length === 0) {
    return;
  }

  speechRequestId += 1;
  const requestId = speechRequestId;
  stopActiveAudio();
  cancelBrowserSpeech();

  if (options?.voiceProvider === "piper") {
    void playServerSpeech(cleanText, options, requestId).catch(() => {
      if (requestId === speechRequestId) {
        stopActiveAudio();
        playBrowserSpeech(cleanText, options);
      }
    });
    return;
  }

  playBrowserSpeech(cleanText, options);
}
