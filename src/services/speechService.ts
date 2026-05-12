export type SpeakOptions = {
  voiceURI?: string;
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

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function cancelSpeech(): void {
  if (!isSpeechSupported()) {
    return;
  }

  window.speechSynthesis.cancel();
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

export function speak(text: string, options?: SpeakOptions): void {
  if (!isSpeechSupported() || text.trim().length === 0) {
    return;
  }

  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = options?.voiceURI
    ? window.speechSynthesis
        .getVoices()
        .find((availableVoice) => availableVoice.voiceURI === options.voiceURI)
    : undefined;

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = clamp(options?.rate, 0.5, 2, 1);
  utterance.pitch = clamp(options?.pitch, 0, 2, 1);
  utterance.volume = clamp(options?.volume, 0, 1, 1);

  window.speechSynthesis.speak(utterance);
}
