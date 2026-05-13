import type { Language } from "../i18n/translations";

export type NotificationMode = "voice" | "beep" | "off";

export type AppSettings = {
  voiceEnabled: boolean;
  notificationMode: NotificationMode;
  voiceURI?: string;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  language: Language;
  theme: "dark" | "light";
};

export const defaultSettings: AppSettings = {
  voiceEnabled: true,
  notificationMode: "voice",
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  language: "en",
  theme: "dark",
};
