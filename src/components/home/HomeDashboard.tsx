import { Activity, CalendarCheck, Clock, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useI18n } from "../../i18n/I18nContext";
import type { TranslationKey } from "../../i18n/translations";
import type { BodyMeasurement, CharacterProfile } from "../../models/profile";
import type { WorkoutSession } from "../../models/session";
import { formatSeconds, getElapsedSeconds } from "../../utils/format";

type HomeDashboardProps = {
  profile: CharacterProfile;
  sessions: WorkoutSession[];
};

type BuiltInAvatar = {
  id: string;
  label: string;
  url: string;
};

type StatItem = {
  label: string;
  value: string;
};

const avatarModules = import.meta.glob("../../assets/avatars/*.{avif,jpeg,jpg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const motivationKeys = [
  "home.motivation1",
  "home.motivation2",
  "home.motivation3",
  "home.motivation4",
  "home.motivation5",
] satisfies TranslationKey[];

const metricDefinitions = [
  { key: "weightKg", labelKey: "character.weightKg", suffix: " kg" },
  { key: "muscleMassKg", labelKey: "character.muscleMassKg", suffix: " kg" },
  { key: "bodyFatPercent", labelKey: "character.bodyFatPercent", suffix: "%" },
  { key: "waistCm", labelKey: "character.waistCm", suffix: " cm" },
  { key: "chestCm", labelKey: "character.chestCm", suffix: " cm" },
] satisfies Array<{
  key: keyof Pick<
    BodyMeasurement,
    "bodyFatPercent" | "chestCm" | "muscleMassKg" | "waistCm" | "weightKg"
  >;
  labelKey: TranslationKey;
  suffix: string;
}>;

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function avatarLabelFromFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const numberedAvatar = baseName.match(/^avatar[-_]?0*(\d+)$/i);

  if (numberedAvatar) {
    return `Avatar ${Number(numberedAvatar[1])}`;
  }

  return baseName
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

const builtInAvatars: BuiltInAvatar[] = Object.entries(avatarModules)
  .map(([path, url]) => {
    const id = fileNameFromPath(path);

    return {
      id,
      label: avatarLabelFromFileName(id),
      url,
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));

function measurementTime(measurement: BodyMeasurement): number {
  const timestamp = new Date(measurement.measuredAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sessionTime(session: WorkoutSession): number {
  const timestamp = new Date(session.completedAt ?? session.startedAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatMetricValue(value: number, suffix: string): string {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value)}${suffix}`;
}

function dateInputValue(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function calculateAge(dateOfBirth?: string, fallbackAge?: number): number | undefined {
  const birthDateValue = dateInputValue(dateOfBirth);

  if (!birthDateValue) {
    return fallbackAge;
  }

  const [year, month, day] = birthDateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return fallbackAge;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 0 ? age : undefined;
}

function resolveProfileImage(profile: CharacterProfile): { alt: string; isPhoto: boolean; url?: string } {
  if (profile.photoDataUrl) {
    return {
      alt: profile.name || "Profile photo",
      isPhoto: true,
      url: profile.photoDataUrl,
    };
  }

  const selectedAvatar =
    builtInAvatars.find((avatar) => avatar.id === profile.selectedAvatarId) ??
    builtInAvatars.find(
      (avatar) =>
        Boolean(profile.selectedAvatarUrl) &&
        avatar.id === fileNameFromPath(profile.selectedAvatarUrl ?? ""),
    ) ??
    builtInAvatars[0];

  return {
    alt: selectedAvatar?.label ?? "Avatar",
    isPhoto: false,
    url: selectedAvatar?.url,
  };
}

export function HomeDashboard({ profile, sessions }: HomeDashboardProps) {
  const { t } = useI18n();
  const motivation = useMemo(() => {
    const index = Math.floor(Math.random() * motivationKeys.length);

    return t(motivationKeys[index] ?? "home.motivation1");
  }, [t]);
  const latestMeasurement = useMemo(() => {
    return [...profile.measurements].sort((left, right) => measurementTime(right) - measurementTime(left))[0];
  }, [profile.measurements]);
  const profileImage = resolveProfileImage(profile);
  const age = calculateAge(profile.dateOfBirth, profile.age);
  const statItems = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    if (typeof age === "number") {
      items.push({ label: t("character.age"), value: String(age) });
    }

    if (typeof profile.heightCm === "number") {
      items.push({ label: t("character.heightCm"), value: formatMetricValue(profile.heightCm, " cm") });
    }

    if (latestMeasurement) {
      metricDefinitions.forEach((definition) => {
        const value = latestMeasurement[definition.key];

        if (typeof value === "number") {
          items.push({
            label: t(definition.labelKey),
            value: formatMetricValue(value, definition.suffix),
          });
        }
      });
    }

    return items;
  }, [age, latestMeasurement, profile.heightCm, t]);
  const recentSessions = useMemo(
    () => [...sessions].sort((left, right) => sessionTime(right) - sessionTime(left)).slice(0, 5),
    [sessions],
  );

  return (
    <section className="space-y-6">
      <div className="py-6 text-center sm:py-10">
        <p className="label">{t("home.section")}</p>
        <h2 className="mx-auto mt-3 max-w-4xl text-4xl font-black leading-tight text-slate-50 sm:text-5xl">
          {motivation}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-slate-400">
          {t("home.welcome")}
        </p>
      </div>

      <div className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="mx-auto w-full max-w-44 shrink-0 md:mx-0">
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              {profileImage.url ? (
                <img
                  className={`aspect-[377/508] w-full ${profileImage.isPhoto ? "object-cover" : "object-contain"}`}
                  src={profileImage.url}
                  alt={profileImage.alt}
                />
              ) : (
                <div className="flex aspect-[377/508] items-center justify-center text-slate-500">
                  <UserRound aria-hidden="true" size={52} />
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="label">{t("home.profilePanel")}</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-50">
              {profile.name.trim() || t("character.unnamed")}
            </h3>
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-100">
                <Activity aria-hidden="true" size={17} />
                {t("home.latestStats")}
              </div>
              {statItems.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {statItems.map((item) => (
                    <div key={item.label} className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                      <p className="label">{item.label}</p>
                      <p className="mt-1 text-xl font-black text-slate-50">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  {t("home.noStats")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarCheck aria-hidden="true" className="text-cyan-200" size={19} />
          <div>
            <p className="label">{t("history.section")}</p>
            <h3 className="text-2xl font-bold text-slate-50">{t("home.recentSessions")}</h3>
          </div>
        </div>

        {recentSessions.length > 0 ? (
          <div className="space-y-2">
            {recentSessions.map((session) => {
              const elapsedSeconds = getElapsedSeconds(session.startedAt, session.completedAt);

              return (
                <div
                  key={session.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-50">{session.workoutName}</p>
                    <p className="text-xs text-slate-500">
                      {session.completed ? t("home.completed") : t("home.partial")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <Clock aria-hidden="true" size={16} />
                    <span className="text-slate-500">{t("home.duration")}</span>
                    <span className="text-cyan-100">
                      {elapsedSeconds > 0 ? formatSeconds(elapsedSeconds) : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            {t("home.noSessions")}
          </div>
        )}
      </div>
    </section>
  );
}
