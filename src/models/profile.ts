export type AvatarHeadShape = "square" | "round" | "long";

export type AvatarBodyType = "slim" | "regular" | "strong";

export type AvatarSettings = {
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  shirtColor: string;
  pantsColor: string;
  headShape: AvatarHeadShape;
  bodyType: AvatarBodyType;
};

export type BodyMeasurement = {
  id: string;
  measuredAt: string;
  weightKg?: number;
  muscleMassKg?: number;
  waistCm?: number;
  chestCm?: number;
  bicepsCm?: number;
  thighCm?: number;
  hipCm?: number;
  bodyFatPercent?: number;
  notes?: string;
};

export type CharacterProfile = {
  name: string;
  age?: number;
  heightCm?: number;
  selectedAvatarUrl?: string;
  photoDataUrl?: string;
  avatar: AvatarSettings;
  measurements: BodyMeasurement[];
  updatedAt: string;
};

export const defaultAvatar: AvatarSettings = {
  skinColor: "#d7a06f",
  hairColor: "#3b2417",
  eyeColor: "#22d3ee",
  shirtColor: "#0891b2",
  pantsColor: "#334155",
  headShape: "square",
  bodyType: "regular",
};

export const defaultProfile: CharacterProfile = {
  name: "",
  selectedAvatarUrl: "/avatars/avatar-01.png",
  avatar: defaultAvatar,
  measurements: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
};
