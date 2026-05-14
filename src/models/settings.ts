import type { Language } from "../i18n/translations";

export type NotificationMode = "voice" | "beep" | "off";
export type VoiceProvider = "piper" | "browser";
export type VoiceLanguage = "app" | Language;

export type AppSettings = {
  voiceEnabled: boolean;
  notificationMode: NotificationMode;
  voiceProvider: VoiceProvider;
  voiceLanguage: VoiceLanguage;
  voiceURI?: string;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  language: Language;
  theme: "dark" | "light";
  exerciseDefaultsVersion: number;
};

export const defaultSettings: AppSettings = {
  voiceEnabled: true,
  notificationMode: "voice",
  voiceProvider: "piper",
  voiceLanguage: "fr",
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  language: "fr",
  theme: "dark",
  exerciseDefaultsVersion: 1,
};
