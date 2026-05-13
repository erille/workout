import { ImageUp, Save, Trash2, UserRound, X } from "lucide-react";
import { type ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type {
  AvatarBodyType,
  AvatarHeadShape,
  AvatarSettings,
  BodyMeasurement,
  CharacterProfile,
} from "../../models/profile";
import { createId } from "../../utils/id";

type CharacterSheetProps = {
  profile: CharacterProfile;
  onSaveProfile: (profile: CharacterProfile) => Promise<void>;
};

type MeasurementDraft = {
  measuredAt: string;
  weightKg: string;
  waistCm: string;
  chestCm: string;
  bicepsCm: string;
  thighCm: string;
  hipCm: string;
  bodyFatPercent: string;
  notes: string;
};

const swatches = [
  "#f2c09a",
  "#d7a06f",
  "#8d5524",
  "#3b2417",
  "#22d3ee",
  "#0891b2",
  "#16a34a",
  "#f97316",
  "#e11d48",
  "#334155",
  "#f8fafc",
  "#111827",
];

const metricKeys = [
  "weightKg",
  "waistCm",
  "chestCm",
  "bicepsCm",
  "thighCm",
  "hipCm",
  "bodyFatPercent",
] as const;

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputValue(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function parseOptionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? undefined : Math.max(0, parsed);
}

function formatMetric(value: number | undefined, suffix: string): string {
  return typeof value === "number" ? `${value}${suffix}` : "-";
}

function createEmptyMeasurementDraft(): MeasurementDraft {
  return {
    measuredAt: todayInputValue(),
    weightKg: "",
    waistCm: "",
    chestCm: "",
    bicepsCm: "",
    thighCm: "",
    hipCm: "",
    bodyFatPercent: "",
    notes: "",
  };
}

function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSide = 640;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas is unavailable."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be loaded."));
    };
    image.src = objectUrl;
  });
}

function AvatarPreview({ avatar }: { avatar: AvatarSettings }) {
  const headRx = avatar.headShape === "round" ? 14 : avatar.headShape === "long" ? 8 : 2;
  const headHeight = avatar.headShape === "long" ? 46 : 38;
  const headY = avatar.headShape === "long" ? 16 : 24;
  const torsoWidth = avatar.bodyType === "slim" ? 50 : avatar.bodyType === "strong" ? 78 : 64;
  const torsoX = 80 - torsoWidth / 2;
  const armWidth = avatar.bodyType === "strong" ? 18 : 14;

  return (
    <svg className="h-64 w-full" viewBox="0 0 160 230" role="img" aria-label="Character avatar">
      <rect x="0" y="0" width="160" height="230" rx="12" fill="#020617" />
      <rect x="56" y={headY} width="48" height={headHeight} rx={headRx} fill={avatar.skinColor} />
      <rect x="58" y={headY} width="44" height="12" rx="2" fill={avatar.hairColor} />
      <rect x="68" y={headY + 22} width="7" height="7" rx="1" fill={avatar.eyeColor} />
      <rect x="86" y={headY + 22} width="7" height="7" rx="1" fill={avatar.eyeColor} />
      <rect x="72" y={headY + 34} width="16" height="3" rx="1" fill="#4b1f18" opacity="0.75" />
      <rect x={torsoX} y="76" width={torsoWidth} height="68" rx="3" fill={avatar.shirtColor} />
      <rect x={torsoX - armWidth - 4} y="80" width={armWidth} height="74" rx="3" fill={avatar.skinColor} />
      <rect x={torsoX + torsoWidth + 4} y="80" width={armWidth} height="74" rx="3" fill={avatar.skinColor} />
      <rect x="56" y="144" width="22" height="60" rx="3" fill={avatar.pantsColor} />
      <rect x="82" y="144" width="22" height="60" rx="3" fill={avatar.pantsColor} />
      <rect x="52" y="202" width="30" height="10" rx="2" fill="#0f172a" />
      <rect x="78" y="202" width="30" height="10" rx="2" fill="#0f172a" />
    </svg>
  );
}

export function CharacterSheet({ onSaveProfile, profile }: CharacterSheetProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CharacterProfile>(profile);
  const [measurementDraft, setMeasurementDraft] = useState<MeasurementDraft>(createEmptyMeasurementDraft);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [measurementMessage, setMeasurementMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const sortedMeasurements = useMemo(
    () => [...draft.measurements].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
    [draft.measurements],
  );
  const latestMeasurement = sortedMeasurements[0];

  const updateDraft = (partial: Partial<CharacterProfile>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setProfileMessage(null);
    setError(null);
  };

  const updateAvatar = (partial: Partial<AvatarSettings>) => {
    setDraft((current) => ({
      ...current,
      avatar: {
        ...current.avatar,
        ...partial,
      },
    }));
    setProfileMessage(null);
    setError(null);
  };

  const updatePhoto = (photoDataUrl?: string) => {
    setDraft((current) => ({
      ...current,
      photoDataUrl,
    }));
    setProfileMessage(null);
    setError(null);
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(t("character.photoError"));
      return;
    }

    void resizePhoto(file)
      .then(updatePhoto)
      .catch(() => setError(t("character.photoError")));
    event.target.value = "";
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSaveProfile(draft);
    setProfileMessage(t("character.profileSaved"));
  };

  const addMeasurement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMeasurementMessage(null);

    const metrics = Object.fromEntries(
      metricKeys.map((key) => [key, parseOptionalNumber(measurementDraft[key])]),
    ) as Pick<
      BodyMeasurement,
      "weightKg" | "waistCm" | "chestCm" | "bicepsCm" | "thighCm" | "hipCm" | "bodyFatPercent"
    >;

    const hasMetric = Object.values(metrics).some((value) => typeof value === "number");

    if (!measurementDraft.measuredAt || !hasMetric) {
      setError(t("character.measurementError"));
      return;
    }

    const measurement: BodyMeasurement = {
      id: createId("measurement"),
      measuredAt: new Date(`${measurementDraft.measuredAt}T12:00:00`).toISOString(),
      ...metrics,
      notes: measurementDraft.notes.trim() || undefined,
    };
    const nextProfile = {
      ...draft,
      measurements: [measurement, ...draft.measurements],
    };

    setDraft(nextProfile);
    setMeasurementDraft(createEmptyMeasurementDraft());
    await onSaveProfile(nextProfile);
    setMeasurementMessage(t("character.measurementSaved"));
  };

  const deleteMeasurement = async (measurementId: string) => {
    const nextProfile = {
      ...draft,
      measurements: draft.measurements.filter((measurement) => measurement.id !== measurementId),
    };
    setDraft(nextProfile);
    await onSaveProfile(nextProfile);
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="label">{t("character.section")}</p>
        <h2 className="text-2xl font-bold text-slate-50">{t("character.title")}</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="panel space-y-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-400 text-slate-950">
              <UserRound aria-hidden="true" size={23} />
            </div>
            <div>
              <p className="label">{t("character.avatar")}</p>
              <h3 className="text-xl font-bold text-slate-50">
                {draft.name.trim() || t("character.unnamed")}
              </h3>
            </div>
          </div>
          {draft.photoDataUrl ? (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <img
                className="h-64 w-full object-cover"
                src={draft.photoDataUrl}
                alt={draft.name.trim() || t("character.unnamed")}
              />
            </div>
          ) : (
            <AvatarPreview avatar={draft.avatar} />
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="secondary-button cursor-pointer">
              <ImageUp aria-hidden="true" size={17} />
              {t("character.uploadPhoto")}
              <input className="sr-only" accept="image/*" type="file" onChange={handlePhotoUpload} />
            </label>
            {draft.photoDataUrl ? (
              <button type="button" className="danger-button" onClick={() => updatePhoto(undefined)}>
                <X aria-hidden="true" size={17} />
                {t("character.removePhoto")}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["skinColor", t("character.skinColor")],
              ["hairColor", t("character.hairColor")],
              ["eyeColor", t("character.eyeColor")],
              ["shirtColor", t("character.shirtColor")],
              ["pantsColor", t("character.pantsColor")],
            ].map(([key, label]) => (
              <label key={key} className="space-y-2">
                <span className="label">{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 w-12 rounded-md border border-slate-700 bg-slate-950"
                    type="color"
                    value={draft.avatar[key as keyof AvatarSettings] as string}
                    onChange={(event) =>
                      updateAvatar({ [key]: event.target.value } as Partial<AvatarSettings>)
                    }
                  />
                  <select
                    className="field"
                    value={draft.avatar[key as keyof AvatarSettings] as string}
                    onChange={(event) =>
                      updateAvatar({ [key]: event.target.value } as Partial<AvatarSettings>)
                    }
                  >
                    {swatches.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            ))}
            <label className="space-y-2">
              <span className="label">{t("character.headShape")}</span>
              <select
                className="field"
                value={draft.avatar.headShape}
                onChange={(event) =>
                  updateAvatar({ headShape: event.target.value as AvatarHeadShape })
                }
              >
                <option value="square">{t("character.headSquare")}</option>
                <option value="round">{t("character.headRound")}</option>
                <option value="long">{t("character.headLong")}</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="label">{t("character.bodyType")}</span>
              <select
                className="field"
                value={draft.avatar.bodyType}
                onChange={(event) =>
                  updateAvatar({ bodyType: event.target.value as AvatarBodyType })
                }
              >
                <option value="slim">{t("character.bodySlim")}</option>
                <option value="regular">{t("character.bodyRegular")}</option>
                <option value="strong">{t("character.bodyStrong")}</option>
              </select>
            </label>
          </div>
        </aside>

        <div className="space-y-5">
          <form className="panel space-y-4 p-4" onSubmit={saveProfile}>
            <div>
              <p className="label">{t("character.profile")}</p>
              <h3 className="text-xl font-bold text-slate-50">{t("character.identity")}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="label">{t("character.name")}</span>
                <input
                  className="field"
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder={t("character.namePlaceholder")}
                />
              </label>
              <label className="space-y-2">
                <span className="label">{t("character.age")}</span>
                <input
                  className="field"
                  min={0}
                  type="number"
                  value={draft.age ?? ""}
                  onChange={(event) =>
                    updateDraft({ age: parseOptionalNumber(event.target.value) })
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="label">{t("character.heightCm")}</span>
                <input
                  className="field"
                  min={0}
                  type="number"
                  value={draft.heightCm ?? ""}
                  onChange={(event) =>
                    updateDraft({ heightCm: parseOptionalNumber(event.target.value) })
                  }
                />
              </label>
            </div>
            {profileMessage ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {profileMessage}
              </div>
            ) : null}
            <button type="submit" className="primary-button">
              <Save aria-hidden="true" size={17} />
              {t("character.saveProfile")}
            </button>
          </form>

          <div className="panel p-4">
            <div>
              <p className="label">{t("character.latest")}</p>
              <h3 className="text-xl font-bold text-slate-50">{t("character.bodyMetrics")}</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [t("character.weightKg"), formatMetric(latestMeasurement?.weightKg, " kg")],
                [t("character.waistCm"), formatMetric(latestMeasurement?.waistCm, " cm")],
                [t("character.chestCm"), formatMetric(latestMeasurement?.chestCm, " cm")],
                [t("character.bicepsCm"), formatMetric(latestMeasurement?.bicepsCm, " cm")],
                [t("character.thighCm"), formatMetric(latestMeasurement?.thighCm, " cm")],
                [t("character.hipCm"), formatMetric(latestMeasurement?.hipCm, " cm")],
                [t("character.bodyFatPercent"), formatMetric(latestMeasurement?.bodyFatPercent, "%")],
                [
                  t("character.measuredAt"),
                  latestMeasurement
                    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                        new Date(latestMeasurement.measuredAt),
                      )
                    : "-",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                  <p className="label">{label}</p>
                  <p className="mt-1 text-2xl font-black text-cyan-200">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <form className="panel space-y-4 p-4" onSubmit={addMeasurement}>
            <div>
              <p className="label">{t("character.progress")}</p>
              <h3 className="text-xl font-bold text-slate-50">{t("character.addMeasurement")}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="label">{t("character.measuredAt")}</span>
                <input
                  className="field"
                  type="date"
                  value={measurementDraft.measuredAt}
                  onChange={(event) =>
                    setMeasurementDraft((current) => ({
                      ...current,
                      measuredAt: event.target.value,
                    }))
                  }
                />
              </label>
              {metricKeys.map((key) => (
                <label key={key} className="space-y-2">
                  <span className="label">{t(`character.${key}`)}</span>
                  <input
                    className="field"
                    min={0}
                    step={key === "bodyFatPercent" ? 0.1 : 0.5}
                    type="number"
                    value={measurementDraft[key]}
                    onChange={(event) =>
                      setMeasurementDraft((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <label className="block space-y-2">
              <span className="label">{t("character.notes")}</span>
              <textarea
                className="field min-h-20 resize-y"
                value={measurementDraft.notes}
                onChange={(event) =>
                  setMeasurementDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder={t("character.notesPlaceholder")}
              />
            </label>
            {error ? (
              <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
            {measurementMessage ? (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {measurementMessage}
              </div>
            ) : null}
            <button type="submit" className="primary-button">
              <Save aria-hidden="true" size={17} />
              {t("character.saveMeasurement")}
            </button>
          </form>

          <div className="panel p-4">
            <div>
              <p className="label">{t("character.timeline")}</p>
              <h3 className="text-xl font-bold text-slate-50">{t("character.measurementHistory")}</h3>
            </div>
            {sortedMeasurements.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                {t("character.noMeasurements")}
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {sortedMeasurements.map((measurement) => (
                  <div
                    key={measurement.id}
                    className="rounded-md border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-slate-50">
                          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                            new Date(measurement.measuredAt),
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {t("character.measurementLine", {
                            weight: formatMetric(measurement.weightKg, " kg"),
                            waist: formatMetric(measurement.waistCm, " cm"),
                            biceps: formatMetric(measurement.bicepsCm, " cm"),
                          })}
                        </p>
                        {measurement.notes ? (
                          <p className="mt-2 text-sm text-slate-300">{measurement.notes}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="danger-button w-fit"
                        onClick={() => void deleteMeasurement(measurement.id)}
                      >
                        <Trash2 aria-hidden="true" size={17} />
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
