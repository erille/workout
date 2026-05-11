# Voice Announcements

## MVP Approach

Use the browser Web Speech API.

Do not integrate external TTS providers in the first version.

## Speech Service API

Create a service:

```ts
export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

export function speak(text: string, options?: SpeakOptions): void;

export function cancelSpeech(): void;

export function isSpeechSupported(): boolean;
```

## Default Voice Settings

```ts
const defaultVoiceSettings = {
  rate: 1,
  pitch: 1,
  volume: 1
};
```

## Announcement Templates

### Time-Based Exercise

```ts
[
  "Next, {exercise} for {duration} seconds.",
  "Let's go. {exercise}, {duration} seconds.",
  "Get ready for {exercise}, {duration} seconds."
]
```

### Reps-Based Exercise

```ts
[
  "Now let's do {exercise}, {reps} reps.",
  "Next, {exercise}, {reps} strong reps.",
  "Get ready for {exercise}, {reps} reps."
]
```

### Break

```ts
[
  "Break time, {break} seconds.",
  "Recover now, {break} seconds.",
  "Nice work. Take {break} seconds."
]
```

### Workout Complete

```ts
[
  "Workout complete. Great job.",
  "Session finished. Well done.",
  "Great work. Workout complete."
]
```

## Requirements

- Voice can be enabled or disabled.
- Voice settings must be saved.
- Cancel previous speech before speaking the next phrase.
- Do not block timer execution while speech is playing.
- If speech is unsupported, app should continue silently.
