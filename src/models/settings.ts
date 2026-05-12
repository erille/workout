import type { Language } from "../i18n/translations";

export type AppSettings = {
  voiceEnabled: boolean;
  voiceURI?: string;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  language: Language;
  theme: "dark" | "light";
};

export const defaultSettings: AppSettings = {
  voiceEnabled: true,
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  language: "en",
  theme: "dark",
};
