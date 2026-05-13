import { Edit3, ImageUp, LineChart, List, Save, Trash2, UserRound, X } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../i18n/I18nContext";
import type {
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
  muscleMassKg: string;
  bodyFatPercent: string;
  waistCm: string;
  chestCm: string;
  bicepsCm: string;
  thighCm: string;
  hipCm: string;
  notes: string;
};

type MeasurementMetricKey =
  | "weightKg"
  | "muscleMassKg"
  | "bodyFatPercent"
  | "waistCm"
  | "chestCm"
  | "bicepsCm"
  | "thighCm"
  | "hipCm";

type TimelineView = "history" | "graph";

type GraphPoint = {
  dateLabel: string;
  valueLabel: string;
  x: number;
  y: number;
};

type GraphTooltip = GraphPoint & {
  color: string;
  metricLabel: string;
};

type BuiltInAvatar = {
  id: string;
  label: string;
  url: string;
};

const avatarModules = import.meta.glob("../../assets/avatars/*.{avif,jpeg,jpg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

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

const metricDefinitions = [
  { key: "weightKg", labelKey: "character.weightKg", suffix: " kg", color: "#22d3ee" },
  { key: "muscleMassKg", labelKey: "character.muscleMassKg", suffix: " kg", color: "#34d399" },
  { key: "bodyFatPercent", labelKey: "character.bodyFatPercent", suffix: "%", color: "#f97316" },
  { key: "waistCm", labelKey: "character.waistCm", suffix: " cm", color: "#f59e0b" },
  { key: "chestCm", labelKey: "character.chestCm", suffix: " cm", color: "#f472b6" },
  { key: "bicepsCm", labelKey: "character.bicepsCm", suffix: " cm", color: "#a78bfa" },
  { key: "thighCm", labelKey: "character.thighCm", suffix: " cm", color: "#fb7185" },
  { key: "hipCm", labelKey: "character.hipCm", suffix: " cm", color: "#60a5fa" },
] as const;

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputValue(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? todayInputValue() : date.toISOString().slice(0, 10);
}

function parseOptionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed) ? undefined : Math.max(0, parsed);
}

function formatMetric(value: number | undefined, suffix: string): string {
  if (typeof value !== "number") {
    return "-";
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}${suffix}`;
}

function createEmptyMeasurementDraft(): MeasurementDraft {
  return {
    measuredAt: todayInputValue(),
    weightKg: "",
    muscleMassKg: "",
    bodyFatPercent: "",
    waistCm: "",
    chestCm: "",
    bicepsCm: "",
    thighCm: "",
    hipCm: "",
    notes: "",
  };
}

function stringifyMeasurementValue(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "";
}

function createMeasurementDraftFromMeasurement(measurement: BodyMeasurement): MeasurementDraft {
  return {
    measuredAt: dateInputValue(measurement.measuredAt),
    weightKg: stringifyMeasurementValue(measurement.weightKg),
    muscleMassKg: stringifyMeasurementValue(measurement.muscleMassKg),
    bodyFatPercent: stringifyMeasurementValue(measurement.bodyFatPercent),
    waistCm: stringifyMeasurementValue(measurement.waistCm),
    chestCm: stringifyMeasurementValue(measurement.chestCm),
    bicepsCm: stringifyMeasurementValue(measurement.bicepsCm),
    thighCm: stringifyMeasurementValue(measurement.thighCm),
    hipCm: stringifyMeasurementValue(measurement.hipCm),
    notes: measurement.notes ?? "",
  };
}

function measurementTime(measurement: BodyMeasurement): number {
  const timestamp = new Date(measurement.measuredAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function MeasurementGraph({
  measurements,
  noDataLabel,
  metricLabels,
}: {
  measurements: BodyMeasurement[];
  noDataLabel: string;
  metricLabels: Record<MeasurementMetricKey, string>;
}) {
  const [tooltip, setTooltip] = useState<GraphTooltip | null>(null);
  const width = 720;
  const height = 300;
  const padding = 34;
  const tooltipWidth = 178;
  const tooltipHeight = 62;
  const datedMeasurements = measurements.filter((measurement) => measurementTime(measurement) > 0);
  const times = datedMeasurements.map(measurementTime);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const timeRange = maxTime - minTime || 1;
  const series = metricDefinitions
    .map((definition) => {
      const values = datedMeasurements
        .map((measurement) => ({
          time: measurementTime(measurement),
          value: measurement[definition.key],
        }))
        .filter((point): point is { time: number; value: number } => typeof point.value === "number");

      if (values.length === 0) {
        return null;
      }

      const minValue = Math.min(...values.map((point) => point.value));
      const maxValue = Math.max(...values.map((point) => point.value));
      const valueRange = maxValue - minValue || 1;
      const points = values.map((point) => ({
        dateLabel: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          new Date(point.time),
        ),
        valueLabel: formatMetric(point.value, definition.suffix),
        x: padding + ((point.time - minTime) / timeRange) * usableWidth,
        y: padding + usableHeight - ((point.value - minValue) / valueRange) * usableHeight,
      }));

      return {
        color: definition.color,
        key: definition.key,
        label: metricLabels[definition.key],
        points,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const showTooltip = (
    event: ReactMouseEvent<SVGElement>,
    line: (typeof series)[number],
    point?: GraphPoint,
  ) => {
    const svg = event.currentTarget.ownerSVGElement;

    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const cursorX = ((event.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const nearestPoint =
      point ??
      line.points.reduce((closest, current) =>
        Math.abs(current.x - cursorX) < Math.abs(closest.x - cursorX) ? current : closest,
      );

    setTooltip({
      ...nearestPoint,
      color: line.color,
      metricLabel: line.label,
    });
  };

  if (series.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 p-3 text-sm text-slate-400">
        {noDataLabel}
      </p>
    );
  }

  const tooltipPosition = tooltip
    ? {
        x: Math.min(Math.max(tooltip.x + 12, 8), width - tooltipWidth - 8),
        y: Math.min(Math.max(tooltip.y - tooltipHeight - 10, 8), height - tooltipHeight - 8),
      }
    : null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/70 p-3">
        <svg
          className="min-w-[42rem]"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          onMouseLeave={() => setTooltip(null)}
        >
          <line
            x1={padding}
            x2={padding}
            y1={padding}
            y2={height - padding}
            stroke="#334155"
            strokeWidth="1"
          />
          <line
            x1={padding}
            x2={width - padding}
            y1={height - padding}
            y2={height - padding}
            stroke="#334155"
            strokeWidth="1"
          />
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={padding}
              x2={width - padding}
              y1={padding + usableHeight * ratio}
              y2={padding + usableHeight * ratio}
              stroke="#1e293b"
              strokeWidth="1"
            />
          ))}
          {series.map((line) => (
            <g key={line.key}>
              {line.points.length > 1 ? (
                <>
                  <polyline
                    fill="none"
                    points={line.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    stroke={line.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                  />
                  <polyline
                    fill="none"
                    points={line.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    pointerEvents="stroke"
                    stroke="transparent"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="18"
                    onMouseMove={(event) => showTooltip(event, line)}
                  />
                </>
              ) : null}
              {line.points.map((point, index) => (
                <g key={`${line.key}-${index}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    fill="transparent"
                    pointerEvents="all"
                    r="10"
                    onMouseMove={(event) => showTooltip(event, line, point)}
                  />
                  <circle cx={point.x} cy={point.y} fill={line.color} pointerEvents="none" r="4" />
                </g>
              ))}
            </g>
          ))}
          {tooltip && tooltipPosition ? (
            <g
              pointerEvents="none"
              transform={`translate(${tooltipPosition.x}, ${tooltipPosition.y})`}
            >
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                rx="6"
                fill="#020617"
                stroke={tooltip.color}
                strokeWidth="1.5"
              />
              <text x="12" y="20" fill={tooltip.color} fontSize="12" fontWeight="700">
                {tooltip.metricLabel}
              </text>
              <text x="12" y="39" fill="#f8fafc" fontSize="16" fontWeight="800">
                {tooltip.valueLabel}
              </text>
              <text x="12" y="54" fill="#94a3b8" fontSize="11" fontWeight="600">
                {tooltip.dateLabel}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2">
        {series.map((line) => (
          <span
            key={line.key}
            className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-200"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
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

export function CharacterSheet({ onSaveProfile, profile }: CharacterSheetProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CharacterProfile>(profile);
  const [measurementDraft, setMeasurementDraft] = useState<MeasurementDraft>(createEmptyMeasurementDraft);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [timelineView, setTimelineView] = useState<TimelineView>("history");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [measurementMessage, setMeasurementMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const measurementFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  useEffect(() => {
    if (!isAvatarMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!avatarMenuRef.current?.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAvatarMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAvatarMenuOpen]);

  const sortedMeasurements = useMemo(
    () => [...draft.measurements].sort((a, b) => measurementTime(b) - measurementTime(a)),
    [draft.measurements],
  );
  const chronologicalMeasurements = useMemo(() => [...sortedMeasurements].reverse(), [sortedMeasurements]);
  const latestMeasurement = sortedMeasurements[0];
  const selectedAvatar =
    builtInAvatars.find((avatar) => avatar.id === draft.selectedAvatarId) ??
    builtInAvatars.find(
      (avatar) =>
        Boolean(draft.selectedAvatarUrl) &&
        avatar.id === fileNameFromPath(draft.selectedAvatarUrl ?? ""),
    ) ??
    builtInAvatars[0];
  const selectedAvatarUrl = selectedAvatar?.url ?? "";
  const metricLabels = useMemo(
    () =>
      Object.fromEntries(
        metricDefinitions.map((definition) => [definition.key, t(definition.labelKey)]),
      ) as Record<MeasurementMetricKey, string>,
    [t],
  );

  const updateDraft = (partial: Partial<CharacterProfile>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setProfileMessage(null);
    setError(null);
  };

  const updateBuiltInAvatar = (avatar: BuiltInAvatar) => {
    setDraft((current) => ({
      ...current,
      selectedAvatarId: avatar.id,
      selectedAvatarUrl: undefined,
      photoDataUrl: undefined,
    }));
    setIsAvatarMenuOpen(false);
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

  const saveMeasurement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMeasurementMessage(null);

    const metrics = Object.fromEntries(
      metricDefinitions.map((definition) => [
        definition.key,
        parseOptionalNumber(measurementDraft[definition.key]),
      ]),
    ) as Pick<BodyMeasurement, MeasurementMetricKey>;

    const hasMetric = Object.values(metrics).some((value) => typeof value === "number");

    if (!measurementDraft.measuredAt || !hasMetric) {
      setError(t("character.measurementError"));
      return;
    }

    const measurement: BodyMeasurement = {
      id: editingMeasurementId ?? createId("measurement"),
      measuredAt: new Date(`${measurementDraft.measuredAt}T12:00:00`).toISOString(),
      ...metrics,
      notes: measurementDraft.notes.trim() || undefined,
    };
    const nextProfile = {
      ...draft,
      measurements: editingMeasurementId
        ? draft.measurements.map((item) => (item.id === editingMeasurementId ? measurement : item))
        : [measurement, ...draft.measurements],
    };

    setDraft(nextProfile);
    setMeasurementDraft(createEmptyMeasurementDraft());
    setEditingMeasurementId(null);
    await onSaveProfile(nextProfile);
    setMeasurementMessage(
      editingMeasurementId ? t("character.measurementUpdated") : t("character.measurementSaved"),
    );
  };

  const editMeasurement = (measurement: BodyMeasurement) => {
    setEditingMeasurementId(measurement.id);
    setMeasurementDraft(createMeasurementDraftFromMeasurement(measurement));
    setMeasurementMessage(null);
    setError(null);
    requestAnimationFrame(() => {
      measurementFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      measurementFormRef.current?.focus({ preventScroll: true });
    });
  };

  const cancelMeasurementEdit = () => {
    setEditingMeasurementId(null);
    setMeasurementDraft(createEmptyMeasurementDraft());
    setMeasurementMessage(null);
    setError(null);
  };

  const deleteMeasurement = async (measurementId: string) => {
    const nextProfile = {
      ...draft,
      measurements: draft.measurements.filter((measurement) => measurement.id !== measurementId),
    };
    setDraft(nextProfile);
    if (editingMeasurementId === measurementId) {
      cancelMeasurementEdit();
    }
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
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <img
              className="aspect-[377/508] w-full object-contain"
              src={draft.photoDataUrl ?? selectedAvatarUrl}
              alt={draft.name.trim() || t("character.unnamed")}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div ref={avatarMenuRef} className="relative">
              <button
                type="button"
                className="secondary-button"
                aria-controls="avatar-menu"
                aria-expanded={isAvatarMenuOpen}
                onClick={() => setIsAvatarMenuOpen((current) => !current)}
              >
                <UserRound aria-hidden="true" size={17} />
                {t("character.selectAvatar")}
              </button>
              {isAvatarMenuOpen ? (
                <div
                  id="avatar-menu"
                  className="absolute left-0 top-full z-30 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] rounded-md border border-slate-700 bg-slate-900 p-3 shadow-2xl"
                >
                  <span className="absolute -top-1 left-8 h-2 w-2 rotate-45 border-l border-t border-slate-700 bg-slate-900" />
                  <div className="mb-3">
                    <p className="label">{t("character.avatarMenuTitle")}</p>
                    {draft.photoDataUrl ? (
                      <p className="mt-1 text-sm text-slate-400">
                        {t("character.photoOverridesAvatar")}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
                    {builtInAvatars.map((avatar) => {
                      const isSelected = selectedAvatar?.id === avatar.id && !draft.photoDataUrl;

                      return (
                        <button
                          key={avatar.url}
                          type="button"
                          className={`overflow-hidden rounded-md border bg-slate-950 text-left transition ${
                            isSelected
                              ? "border-cyan-300 ring-2 ring-cyan-300/35"
                              : "border-slate-800 hover:border-slate-500"
                          }`}
                          aria-pressed={isSelected}
                          onClick={() => updateBuiltInAvatar(avatar)}
                        >
                          <img
                            className="aspect-[377/508] w-full object-contain"
                            src={avatar.url}
                            alt={avatar.label}
                          />
                          <span className="block px-2 py-1 text-xs font-semibold text-slate-300">
                            {avatar.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
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

          <form
            className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4"
            onSubmit={saveProfile}
          >
            <div>
              <p className="label">{t("character.profile")}</p>
              <h3 className="text-xl font-bold text-slate-50">{t("character.identity")}</h3>
            </div>
            <label className="block space-y-2">
              <span className="label">{t("character.name")}</span>
              <input
                className="field"
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                placeholder={t("character.namePlaceholder")}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
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
            <button type="submit" className="primary-button w-full">
              <Save aria-hidden="true" size={17} />
              {t("character.saveProfile")}
            </button>
          </form>
        </aside>

        <div className="space-y-5">
          <div className="panel p-4">
            <div>
              <p className="label">{t("character.latest")}</p>
              <h3 className="text-xl font-bold text-slate-50">{t("character.bodyMetrics")}</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ...metricDefinitions.map((definition) => [
                  t(definition.labelKey),
                  formatMetric(latestMeasurement?.[definition.key], definition.suffix),
                ]),
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

          <form
            ref={measurementFormRef}
            className="panel scroll-mt-4 space-y-4 p-4 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            tabIndex={-1}
            onSubmit={saveMeasurement}
          >
            <div>
              <p className="label">{t("character.progress")}</p>
              <h3 className="text-xl font-bold text-slate-50">
                {editingMeasurementId ? t("character.editMeasurement") : t("character.addMeasurement")}
              </h3>
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
              {metricDefinitions.map((definition) => (
                <label key={definition.key} className="space-y-2">
                  <span className="label">{t(definition.labelKey)}</span>
                  <input
                    className="field"
                    min={0}
                    step={0.01}
                    type="number"
                    value={measurementDraft[definition.key]}
                    onChange={(event) =>
                      setMeasurementDraft((current) => ({
                        ...current,
                        [definition.key]: event.target.value,
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
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="primary-button">
                <Save aria-hidden="true" size={17} />
                {editingMeasurementId ? t("history.editSave") : t("character.saveMeasurement")}
              </button>
              {editingMeasurementId ? (
                <button type="button" className="secondary-button" onClick={cancelMeasurementEdit}>
                  <X aria-hidden="true" size={17} />
                  {t("character.cancelMeasurementEdit")}
                </button>
              ) : null}
            </div>
          </form>

          <div className="panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="label">{t("character.timeline")}</p>
                <h3 className="text-xl font-bold text-slate-50">
                  {t("character.measurementHistory")}
                </h3>
              </div>
              <div className="flex w-fit rounded-md border border-slate-800 bg-slate-950/70 p-1">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-bold transition ${
                    timelineView === "history"
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setTimelineView("history")}
                >
                  <List aria-hidden="true" size={16} />
                  {t("character.timelineHistory")}
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-bold transition ${
                    timelineView === "graph"
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  onClick={() => setTimelineView("graph")}
                >
                  <LineChart aria-hidden="true" size={16} />
                  {t("character.timelineGraph")}
                </button>
              </div>
            </div>
            {sortedMeasurements.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                {t("character.noMeasurements")}
              </p>
            ) : timelineView === "graph" ? (
              <div className="mt-4">
                <MeasurementGraph
                  measurements={chronologicalMeasurements}
                  metricLabels={metricLabels}
                  noDataLabel={t("character.noGraphData")}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {sortedMeasurements.map((measurement) => (
                  <div
                    key={measurement.id}
                    className="rounded-md border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold text-slate-50">
                          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                            new Date(measurement.measuredAt),
                          )}
                        </p>
                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <button
                            type="button"
                            className="secondary-button h-9 w-9 px-0"
                            aria-label={t("common.edit")}
                            title={t("common.edit")}
                            onClick={() => editMeasurement(measurement)}
                          >
                            <Edit3 aria-hidden="true" size={16} />
                          </button>
                          <button
                            type="button"
                            className="danger-button h-9 w-9 px-0"
                            aria-label={t("common.delete")}
                            title={t("common.delete")}
                            onClick={() => void deleteMeasurement(measurement.id)}
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {metricDefinitions.map((definition) => (
                          <div
                            key={definition.key}
                            className="rounded-md border border-slate-800 bg-slate-900/60 p-2"
                          >
                            <p className="label">{t(definition.labelKey)}</p>
                            <p className="mt-1 text-sm font-bold text-slate-100">
                              {formatMetric(measurement[definition.key], definition.suffix)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {measurement.notes ? (
                        <p className="text-sm text-slate-300">{measurement.notes}</p>
                      ) : null}
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
