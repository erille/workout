import type { Language } from "../i18n/translations";
import {
  defaultExerciseCategoryDefinitions,
  type ExerciseCategoryDefinition,
} from "./exercise";

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
  exerciseDefaultsVersion: number;
  exerciseCategories: ExerciseCategoryDefinition[];
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
  exerciseDefaultsVersion: 1,
  exerciseCategories: defaultExerciseCategoryDefinitions.map((category) => ({
    ...category,
    labels: { ...category.labels },
  })),
};
