export type AudioCueType = "work" | "rest" | "complete";

type AudioContextConstructor = typeof AudioContext;

type WindowWithWebAudio = Window & {
  webkitAudioContext?: AudioContextConstructor;
};

type Tone = {
  frequency: number;
  start: number;
  duration: number;
  gain: number;
};

const cueTones: Record<AudioCueType, Tone[]> = {
  work: [
    { frequency: 880, start: 0, duration: 0.12, gain: 0.28 },
    { frequency: 1175, start: 0.15, duration: 0.12, gain: 0.24 },
  ],
  rest: [
    { frequency: 440, start: 0, duration: 0.18, gain: 0.24 },
    { frequency: 330, start: 0.22, duration: 0.18, gain: 0.2 },
  ],
  complete: [
    { frequency: 660, start: 0, duration: 0.12, gain: 0.22 },
    { frequency: 880, start: 0.15, duration: 0.12, gain: 0.24 },
    { frequency: 1320, start: 0.3, duration: 0.16, gain: 0.2 },
  ],
};

let audioContext: AudioContext | null = null;
const activeOscillators = new Set<OscillatorNode>();

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ?? (window as WindowWithWebAudio).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  audioContext ??= new AudioContextClass();
  return audioContext;
}

export function isAudioCueSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.AudioContext ?? (window as WindowWithWebAudio).webkitAudioContext);
}

export function cancelAudioCues(): void {
  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // The node may already have ended; either way it is no longer useful.
    }
  });
  activeOscillators.clear();
}

export function playAudioCue(type: AudioCueType, volume = 1): void {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  void context.resume();

  const safeVolume = clamp(volume, 0, 1, 1);
  const startAt = context.currentTime + 0.02;

  cueTones[type].forEach((tone) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = startAt + tone.start;
    const toneEnd = toneStart + tone.duration;
    const peakGain = tone.gain * safeVolume;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), toneStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

    oscillator.connect(gain);
    gain.connect(context.destination);
    activeOscillators.add(oscillator);
    oscillator.onended = () => {
      activeOscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(toneStart);
    oscillator.stop(toneEnd + 0.04);
  });
}
