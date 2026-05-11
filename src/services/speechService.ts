export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
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

export function speak(text: string, options?: SpeakOptions): void {
  if (!isSpeechSupported() || text.trim().length === 0) {
    return;
  }

  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = clamp(options?.rate, 0.5, 2, 1);
  utterance.pitch = clamp(options?.pitch, 0, 2, 1);
  utterance.volume = clamp(options?.volume, 0, 1, 1);

  window.speechSynthesis.speak(utterance);
}
