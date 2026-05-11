export type AppSettings = {
  voiceEnabled: boolean;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  theme: "dark" | "light";
};

export const defaultSettings: AppSettings = {
  voiceEnabled: true,
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
  theme: "dark",
};
