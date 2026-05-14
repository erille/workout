import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  type LucideIcon,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { translateExerciseName } from "../../i18n/exerciseNames";
import type { CharacterProfile } from "../../models/profile";
import type { WorkoutSession } from "../../models/session";

type StatisticsPageProps = {
  profile: CharacterProfile;
  sessions: WorkoutSession[];
};

type ViewMode = "weeks" | "month" | "year";

type PeriodBucket = {
  key: string;
  label: string;
  count: number;
};

type CalendarDay = {
  key: string;
  date: Date;
  count: number;
  isCurrentMonth: boolean;
};

type LiftEntry = {
  date: Date;
  exerciseId?: string;
  exerciseName: string;
  estimatedOneRepMaxKg: number;
  reps: number;
  volumeKg: number;
  weightKg: number;
};

type LiftExerciseSummary = {
  bestEstimatedOneRepMaxKg: number;
  exerciseId?: string;
  exerciseName: string;
  sets: number;
  volumeKg: number;
};

type LiftVolumeBucket = {
  bestEstimatedOneRepMaxKg: number;
  key: string;
  label: string;
  sets: number;
  volumeKg: number;
};

const viewModes: Array<{ id: ViewMode; labelKey: "statistics.weeks" | "statistics.month" | "statistics.year" }> = [
  { id: "weeks", labelKey: "statistics.weeks" },
  { id: "month", labelKey: "statistics.month" },
  { id: "year", labelKey: "statistics.year" },
];
const weekDayIndexes = [1, 2, 3, 4, 5, 6, 0];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = startOfDay(date);
  start.setDate(start.getDate() + offset);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function yearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function getSessionDates(sessions: WorkoutSession[]): Date[] {
  return sessions
    .map((session) => new Date(session.startedAt))
    .filter(isValidDate)
    .map(startOfDay);
}

function countDatesInRange(dates: Date[], start: Date, end: Date): number {
  const startTime = start.getTime();
  const endTime = end.getTime();

  return dates.filter((date) => {
    const time = date.getTime();
    return time >= startTime && time < endTime;
  }).length;
}

function countDatesOnDay(dates: Date[], date: Date): number {
  const key = toDateKey(date);
  return dates.filter((sessionDate) => toDateKey(sessionDate) === key).length;
}

function formatMonth(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortMonth(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
  }).format(date);
}

function formatShortDate(locale: string, date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatWeekLabel(locale: string, start: Date): string {
  return `${formatShortDate(locale, start)} - ${formatShortDate(locale, addDays(start, 6))}`;
}

function getWeekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const sunday = new Date(2026, 1, 1);

  return weekDayIndexes.map((index) => formatter.format(addDays(sunday, index)));
}

function buildWeekBuckets(dates: Date[], locale: string, today: Date): PeriodBucket[] {
  const currentWeekStart = startOfWeek(today);

  return Array.from({ length: 12 }, (_, index) => {
    const start = addDays(currentWeekStart, (index - 11) * 7);
    const end = addDays(start, 7);

    return {
      key: toDateKey(start),
      label: formatWeekLabel(locale, start),
      count: countDatesInRange(dates, start, end),
    };
  });
}

function buildMonthCalendar(dates: Date[], selectedMonth: Date): CalendarDay[] {
  const start = monthStart(selectedMonth);
  const calendarStart = startOfWeek(start);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(calendarStart, index);

    return {
      key: toDateKey(date),
      date,
      count: countDatesOnDay(dates, date),
      isCurrentMonth: date.getMonth() === selectedMonth.getMonth(),
    };
  });
}

function buildYearBuckets(dates: Date[], locale: string, selectedYear: Date): PeriodBucket[] {
  const start = yearStart(selectedYear);

  return Array.from({ length: 12 }, (_, index) => {
    const month = addMonths(start, index);

    return {
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: formatShortMonth(locale, month),
      count: countDatesInRange(dates, month, addMonths(month, 1)),
    };
  });
}

function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

function getLatestBodyWeightKg(profile: CharacterProfile): number | undefined {
  return [...profile.measurements]
    .filter((measurement) => typeof measurement.weightKg === "number")
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0]?.weightKg;
}

function getLiftEntries(sessions: WorkoutSession[]): LiftEntry[] {
  return sessions.flatMap((session) => {
    const date = startOfDay(new Date(session.startedAt));

    if (!isValidDate(date)) {
      return [];
    }

    return session.steps.flatMap((step) => {
      if (
        step.type !== "reps" ||
        typeof step.weight !== "number" ||
        step.weight <= 0 ||
        typeof step.reps !== "number" ||
        step.reps <= 0
      ) {
        return [];
      }

      return [
        {
          date,
          exerciseId: step.exerciseId,
          exerciseName: step.exerciseName,
          estimatedOneRepMaxKg: estimateOneRepMaxKg(step.weight, step.reps),
          reps: step.reps,
          volumeKg: step.weight * step.reps,
          weightKg: step.weight,
        },
      ];
    });
  });
}

function getLiftVolumeInRange(entries: LiftEntry[], start: Date, end: Date): number {
  const startTime = start.getTime();
  const endTime = end.getTime();

  return entries
    .filter((entry) => {
      const time = entry.date.getTime();
      return time >= startTime && time < endTime;
    })
    .reduce((total, entry) => total + entry.volumeKg, 0);
}

function getLiftEntriesInRange(entries: LiftEntry[], start: Date, end: Date): LiftEntry[] {
  const startTime = start.getTime();
  const endTime = end.getTime();

  return entries.filter((entry) => {
    const time = entry.date.getTime();
    return time >= startTime && time < endTime;
  });
}

function buildLiftYearBuckets(
  entries: LiftEntry[],
  locale: string,
  selectedYear: Date,
): LiftVolumeBucket[] {
  const start = yearStart(selectedYear);

  return Array.from({ length: 12 }, (_, index) => {
    const month = addMonths(start, index);
    const monthEntries = getLiftEntriesInRange(entries, month, addMonths(month, 1));

    return {
      bestEstimatedOneRepMaxKg: Math.max(
        0,
        ...monthEntries.map((entry) => entry.estimatedOneRepMaxKg),
      ),
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: formatShortMonth(locale, month),
      sets: monthEntries.length,
      volumeKg: monthEntries.reduce((total, entry) => total + entry.volumeKg, 0),
    };
  });
}

function getTopLiftExercises(entries: LiftEntry[]): LiftExerciseSummary[] {
  const summaries = new Map<string, LiftExerciseSummary>();

  entries.forEach((entry) => {
    const key = entry.exerciseId ?? entry.exerciseName.toLowerCase();
    const current = summaries.get(key) ?? {
      bestEstimatedOneRepMaxKg: 0,
      exerciseId: entry.exerciseId,
      exerciseName: entry.exerciseName,
      sets: 0,
      volumeKg: 0,
    };

    summaries.set(key, {
      ...current,
      bestEstimatedOneRepMaxKg: Math.max(
        current.bestEstimatedOneRepMaxKg,
        entry.estimatedOneRepMaxKg,
      ),
      sets: current.sets + 1,
      volumeKg: current.volumeKg + entry.volumeKg,
    });
  });

  return [...summaries.values()].sort((a, b) => b.volumeKg - a.volumeKg).slice(0, 5);
}

function maxCount(values: Array<{ count: number }>): number {
  return Math.max(1, ...values.map((value) => value.count));
}

function maxVolume(values: Array<{ volumeKg: number }>): number {
  return Math.max(1, ...values.map((value) => value.volumeKg));
}

function maxEstimatedOneRepMax(values: Array<{ bestEstimatedOneRepMaxKg: number }>): number {
  return Math.max(1, ...values.map((value) => value.bestEstimatedOneRepMaxKg));
}

function formatKg(locale: string, value: number, maximumFractionDigits = 0): string {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 1 : 0,
  }).format(value)} kg`;
}

function getHeatClass(count: number, isCurrentMonth: boolean): string {
  if (!isCurrentMonth) {
    return "border-slate-900 bg-slate-950/40 text-slate-700";
  }

  if (count >= 3) {
    return "border-emerald-300/70 bg-emerald-300 text-emerald-950";
  }

  if (count === 2) {
    return "border-cyan-300/70 bg-cyan-300/70 text-slate-950";
  }

  if (count === 1) {
    return "border-cyan-500/50 bg-cyan-500/20 text-cyan-100";
  }

  return "border-slate-800 bg-slate-950/70 text-slate-500";
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-200">
          <Icon aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="label">{label}</p>
          <p className="text-2xl font-black tracking-normal text-slate-50">{value}</p>
        </div>
      </div>
    </div>
  );
}

function BarList({ buckets }: { buckets: PeriodBucket[] }) {
  const topCount = maxCount(buckets);

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_2.5rem] items-center gap-3">
          <p className="truncate text-sm font-semibold text-slate-300">{bucket.label}</p>
          <div className="h-8 overflow-hidden rounded-md bg-slate-950/80">
            <div
              className="flex h-full items-center justify-end rounded-md bg-cyan-400 px-2 text-xs font-black text-slate-950 transition-all"
              style={{ width: `${Math.max(bucket.count === 0 ? 0 : 12, (bucket.count / topCount) * 100)}%` }}
            >
              {bucket.count > 0 ? bucket.count : ""}
            </div>
          </div>
          <p className="text-right text-sm font-bold text-slate-300">{bucket.count}</p>
        </div>
      ))}
    </div>
  );
}

function VolumeBarList({
  buckets,
  locale,
}: {
  buckets: LiftVolumeBucket[];
  locale: string;
}) {
  const topVolume = maxVolume(buckets);

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="grid grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-3">
          <p className="truncate text-sm font-semibold text-slate-300">{bucket.label}</p>
          <div className="h-8 overflow-hidden rounded-md bg-slate-950/80">
            <div
              className="flex h-full items-center justify-end rounded-md bg-emerald-300 px-2 text-xs font-black text-emerald-950 transition-all"
              style={{
                width: `${Math.max(bucket.volumeKg === 0 ? 0 : 12, (bucket.volumeKg / topVolume) * 100)}%`,
              }}
            >
              {bucket.volumeKg > 0 ? formatKg(locale, bucket.volumeKg) : ""}
            </div>
          </div>
          <p className="text-right text-sm font-bold text-slate-300">
            {formatKg(locale, bucket.volumeKg)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ExerciseTrendPanel({
  buckets,
  entries,
  exerciseName,
  locale,
}: {
  buckets: LiftVolumeBucket[];
  entries: LiftEntry[];
  exerciseName: string;
  locale: string;
}) {
  const { t } = useI18n();
  const topVolume = maxVolume(buckets);
  const topEstimatedOneRepMax = maxEstimatedOneRepMax(buckets);
  const sortedEntries = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  const bestEntry = entries.reduce<LiftEntry | undefined>(
    (best, entry) =>
      !best || entry.estimatedOneRepMaxKg > best.estimatedOneRepMaxKg ? entry : best,
    undefined,
  );
  const totalVolume = entries.reduce((total, entry) => total + entry.volumeKg, 0);

  return (
    <div className="rounded-md border border-cyan-300/40 bg-cyan-300/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{t("statistics.exerciseDetails")}</p>
          <h4 className="text-xl font-bold text-slate-50">{exerciseName}</h4>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md bg-slate-950/70 px-3 py-2">
            <p className="label">{t("statistics.sets")}</p>
            <p className="font-black text-slate-50">{entries.length}</p>
          </div>
          <div className="rounded-md bg-slate-950/70 px-3 py-2">
            <p className="label">{t("statistics.volume")}</p>
            <p className="font-black text-slate-50">{formatKg(locale, totalVolume)}</p>
          </div>
          <div className="rounded-md bg-slate-950/70 px-3 py-2">
            <p className="label">{t("statistics.bestEstimatedShort")}</p>
            <p className="font-black text-slate-50">
              {bestEntry ? formatKg(locale, bestEntry.estimatedOneRepMaxKg, 1) : "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-bold text-slate-100">{t("statistics.exerciseVolumeTrend")}</p>
          <div className="space-y-3">
            {buckets.map((bucket) => (
              <div key={bucket.key} className="grid grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                <p className="truncate text-sm font-semibold text-slate-300">{bucket.label}</p>
                <div className="h-7 overflow-hidden rounded-md bg-slate-950/80">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-cyan-300 px-2 text-xs font-black text-slate-950"
                    style={{
                      width: `${Math.max(bucket.volumeKg === 0 ? 0 : 12, (bucket.volumeKg / topVolume) * 100)}%`,
                    }}
                  >
                    {bucket.volumeKg > 0 ? formatKg(locale, bucket.volumeKg) : ""}
                  </div>
                </div>
                <p className="text-right text-sm font-bold text-slate-300">
                  {formatKg(locale, bucket.volumeKg)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold text-slate-100">{t("statistics.exerciseStrengthTrend")}</p>
          <div className="space-y-3">
            {buckets.map((bucket) => (
              <div key={bucket.key} className="grid grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                <p className="truncate text-sm font-semibold text-slate-300">{bucket.label}</p>
                <div className="h-7 overflow-hidden rounded-md bg-slate-950/80">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-amber-300 px-2 text-xs font-black text-amber-950"
                    style={{
                      width: `${Math.max(
                        bucket.bestEstimatedOneRepMaxKg === 0 ? 0 : 12,
                        (bucket.bestEstimatedOneRepMaxKg / topEstimatedOneRepMax) * 100,
                      )}%`,
                    }}
                  >
                    {bucket.bestEstimatedOneRepMaxKg > 0
                      ? formatKg(locale, bucket.bestEstimatedOneRepMaxKg, 1)
                      : ""}
                  </div>
                </div>
                <p className="text-right text-sm font-bold text-slate-300">
                  {bucket.bestEstimatedOneRepMaxKg > 0
                    ? formatKg(locale, bucket.bestEstimatedOneRepMaxKg, 1)
                    : "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-3 text-sm font-bold text-slate-100">{t("statistics.recentSets")}</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {sortedEntries.map((entry, index) => (
            <div
              key={`${entry.date.toISOString()}-${entry.weightKg}-${entry.reps}-${index}`}
              className="rounded-md border border-slate-800 bg-slate-950/70 p-3"
            >
              <p className="text-xs font-semibold uppercase text-cyan-200">
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(entry.date)}
              </p>
              <p className="mt-1 font-bold text-slate-50">
                {formatKg(locale, entry.weightKg, 1)} x {entry.reps}
              </p>
              <p className="text-sm text-slate-400">
                {t("statistics.volume")}: {formatKg(locale, entry.volumeKg)}
              </p>
              <p className="text-sm text-slate-400">
                {t("statistics.bestEstimatedShort")}:{" "}
                {formatKg(locale, entry.estimatedOneRepMaxKg, 1)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t("statistics.exerciseDetailNote", {
            exercise: exerciseName,
          })}
        </p>
      </div>
    </div>
  );
}

export function StatisticsPage({ profile, sessions }: StatisticsPageProps) {
  const { language, t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>("weeks");
  const [selectedLiftExerciseKey, setSelectedLiftExerciseKey] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()));
  const [selectedYear, setSelectedYear] = useState(() => yearStart(new Date()));
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const today = startOfDay(new Date());

  const sessionDates = useMemo(() => getSessionDates(sessions), [sessions]);
  const weekBuckets = useMemo(
    () => buildWeekBuckets(sessionDates, locale, today),
    [locale, sessionDates, today],
  );
  const monthDays = useMemo(
    () => buildMonthCalendar(sessionDates, selectedMonth),
    [selectedMonth, sessionDates],
  );
  const yearBuckets = useMemo(
    () => buildYearBuckets(sessionDates, locale, selectedYear),
    [locale, selectedYear, sessionDates],
  );
  const liftEntries = useMemo(() => getLiftEntries(sessions), [sessions]);
  const liftYearBuckets = useMemo(
    () => buildLiftYearBuckets(liftEntries, locale, selectedYear),
    [liftEntries, locale, selectedYear],
  );
  const topLiftExercises = useMemo(() => getTopLiftExercises(liftEntries), [liftEntries]);
  const selectedLiftExercise =
    topLiftExercises.find(
      (exercise) => (exercise.exerciseId ?? exercise.exerciseName.toLowerCase()) === selectedLiftExerciseKey,
    ) ?? topLiftExercises[0];
  const selectedLiftExerciseKeyValue = selectedLiftExercise
    ? selectedLiftExercise.exerciseId ?? selectedLiftExercise.exerciseName.toLowerCase()
    : null;
  const selectedLiftEntries = selectedLiftExerciseKeyValue
    ? liftEntries.filter(
        (entry) =>
          (entry.exerciseId ?? entry.exerciseName.toLowerCase()) === selectedLiftExerciseKeyValue,
      )
    : [];
  const selectedLiftBuckets = useMemo(
    () => buildLiftYearBuckets(selectedLiftEntries, locale, selectedYear),
    [locale, selectedLiftEntries, selectedYear],
  );

  const totalWorkouts = sessionDates.length;
  const fullWorkouts = sessions.filter((session) => session.completed).length;
  const partialWorkouts = sessions.length - fullWorkouts;
  const thisWeekCount = countDatesInRange(sessionDates, startOfWeek(today), addDays(startOfWeek(today), 7));
  const thisMonthCount = countDatesInRange(sessionDates, monthStart(today), addMonths(monthStart(today), 1));
  const thisYearCount = countDatesInRange(sessionDates, yearStart(today), addYears(yearStart(today), 1));
  const bestWeek = weekBuckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best), weekBuckets[0]);
  const bestMonth = yearBuckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best), yearBuckets[0]);
  const weekdayLabels = getWeekdayLabels(locale);
  const selectedYearNumber = selectedYear.getFullYear();
  const totalLiftVolumeKg = liftEntries.reduce((total, entry) => total + entry.volumeKg, 0);
  const thisMonthLiftVolumeKg = getLiftVolumeInRange(
    liftEntries,
    monthStart(today),
    addMonths(monthStart(today), 1),
  );
  const previousMonthStart = addMonths(monthStart(today), -1);
  const previousMonthLiftVolumeKg = getLiftVolumeInRange(
    liftEntries,
    previousMonthStart,
    monthStart(today),
  );
  const liftVolumeDeltaKg = thisMonthLiftVolumeKg - previousMonthLiftVolumeKg;
  const bestLiftEntry = liftEntries.reduce<LiftEntry | undefined>(
    (best, entry) =>
      !best || entry.estimatedOneRepMaxKg > best.estimatedOneRepMaxKg ? entry : best,
    undefined,
  );
  const latestBodyWeightKg = getLatestBodyWeightKg(profile);

  return (
    <section className="space-y-5">
      <div>
        <p className="label">{t("statistics.section")}</p>
        <h2 className="text-2xl font-bold text-slate-50">{t("statistics.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{t("statistics.description")}</p>
      </div>

      <div className="panel space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">{t("statistics.workoutOverview")}</p>
            <h3 className="text-xl font-bold text-slate-50">{t("statistics.workoutOverviewTitle")}</h3>
          </div>
          <div className="flex w-fit rounded-md border border-slate-800 bg-slate-950/70 p-1">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`rounded px-3 py-2 text-sm font-bold transition ${
                viewMode === mode.id ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"
              }`}
              onClick={() => setViewMode(mode.id)}
            >
              {t(mode.labelKey)}
            </button>
          ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={BarChart3} label={t("statistics.totalWorkouts")} value={String(totalWorkouts)} />
          <StatCard icon={CalendarDays} label={t("statistics.thisWeek")} value={String(thisWeekCount)} />
          <StatCard icon={CalendarDays} label={t("statistics.thisMonth")} value={String(thisMonthCount)} />
          <StatCard icon={CalendarDays} label={t("statistics.thisYear")} value={String(thisYearCount)} />
          <StatCard icon={CircleGauge} label={t("statistics.partialWorkouts")} value={String(partialWorkouts)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-md border border-slate-800 bg-slate-950/55 p-4">
          {totalWorkouts === 0 ? (
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-6 text-slate-300">
              {t("statistics.empty")}
            </div>
          ) : null}

          {viewMode === "weeks" ? (
            <div>
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="label">{t("statistics.weekChart")}</p>
                  <h3 className="text-xl font-bold text-slate-50">{t("statistics.lastWeeks")}</h3>
                </div>
              </div>
              <BarList buckets={weekBuckets} />
            </div>
          ) : null}

          {viewMode === "month" ? (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="label">{t("statistics.monthCalendar")}</p>
                  <h3 className="text-xl font-bold text-slate-50">{formatMonth(locale, selectedMonth)}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="secondary-button px-3"
                    aria-label={t("statistics.previousMonth")}
                    onClick={() => setSelectedMonth((current) => addMonths(current, -1))}
                  >
                    <ChevronLeft aria-hidden="true" size={17} />
                  </button>
                  <button
                    type="button"
                    className="secondary-button px-3"
                    aria-label={t("statistics.nextMonth")}
                    onClick={() => setSelectedMonth((current) => addMonths(current, 1))}
                  >
                    <ChevronRight aria-hidden="true" size={17} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weekdayLabels.map((label) => (
                  <p key={label} className="text-center text-xs font-bold uppercase text-slate-500">
                    {label}
                  </p>
                ))}
                {monthDays.map((day) => (
                  <div
                    key={day.key}
                    className={`flex aspect-square min-h-10 flex-col items-center justify-center rounded-md border p-1 text-center ${getHeatClass(
                      day.count,
                      day.isCurrentMonth,
                    )}`}
                    title={t("statistics.dayCount", {
                      count: day.count,
                      plural: day.count === 1 ? "" : "s",
                    })}
                  >
                    <span className="text-xs font-bold">{day.date.getDate()}</span>
                    {day.count > 0 ? <span className="text-sm font-black">{day.count}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {viewMode === "year" ? (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="label">{t("statistics.yearChart")}</p>
                  <h3 className="text-xl font-bold text-slate-50">{selectedYearNumber}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="secondary-button px-3"
                    aria-label={t("statistics.previousYear")}
                    onClick={() => setSelectedYear((current) => addYears(current, -1))}
                  >
                    <ChevronLeft aria-hidden="true" size={17} />
                  </button>
                  <button
                    type="button"
                    className="secondary-button px-3"
                    aria-label={t("statistics.nextYear")}
                    onClick={() => setSelectedYear((current) => addYears(current, 1))}
                  >
                    <ChevronRight aria-hidden="true" size={17} />
                  </button>
                </div>
              </div>
              <BarList buckets={yearBuckets} />
            </div>
          ) : null}
          </div>

          <aside className="space-y-4">
            <div className="rounded-md border border-slate-800 bg-slate-950/55 p-4">
            <p className="label">{t("statistics.breakdown")}</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">{t("statistics.fullWorkouts")}</span>
                <span className="rounded-md bg-emerald-300 px-2 py-1 text-sm font-black text-emerald-950">
                  {fullWorkouts}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">{t("statistics.partialWorkouts")}</span>
                <span className="rounded-md bg-amber-300 px-2 py-1 text-sm font-black text-amber-950">
                  {partialWorkouts}
                </span>
              </div>
            </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-950/55 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-300/15 text-amber-200">
                <Trophy aria-hidden="true" size={20} />
              </span>
              <div>
                <p className="label">{t("statistics.records")}</p>
                <h3 className="text-lg font-bold text-slate-50">{t("statistics.bestPeriods")}</h3>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div>
                <p className="font-semibold text-slate-100">{t("statistics.bestWeek")}</p>
                <p>
                  {bestWeek?.label ?? "-"} - {bestWeek?.count ?? 0}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-100">{t("statistics.bestMonth")}</p>
                <p>
                  {bestMonth?.label ?? "-"} - {bestMonth?.count ?? 0}
                </p>
              </div>
            </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label">{t("statistics.liftingSection")}</p>
            <h3 className="text-xl font-bold text-slate-50">{t("statistics.liftingTitle")}</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">{t("statistics.liftingDescription")}</p>
          </div>
          <span className="rounded-md border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-sm font-bold text-emerald-100">
            {t("statistics.liftingExample")}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BarChart3}
            label={t("statistics.totalLifted")}
            value={formatKg(locale, totalLiftVolumeKg)}
          />
          <StatCard
            icon={CalendarDays}
            label={t("statistics.liftedThisMonth")}
            value={formatKg(locale, thisMonthLiftVolumeKg)}
          />
          <StatCard
            icon={CircleGauge}
            label={t("statistics.monthlyLiftDelta")}
            value={`${liftVolumeDeltaKg >= 0 ? "+" : ""}${formatKg(locale, liftVolumeDeltaKg)}`}
          />
          <StatCard
            icon={Trophy}
            label={t("statistics.bestEstimatedOneRepMax")}
            value={bestLiftEntry ? formatKg(locale, bestLiftEntry.estimatedOneRepMaxKg, 1) : "-"}
          />
        </div>

        {liftEntries.length === 0 ? (
          <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
            {t("statistics.noLiftingData")}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-4">
                <p className="label">{t("statistics.liftVolumeByMonth")}</p>
                <h4 className="text-lg font-bold text-slate-50">{selectedYearNumber}</h4>
              </div>
              <VolumeBarList buckets={liftYearBuckets} locale={locale} />
            </div>

            <aside className="space-y-4">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
                <p className="label">{t("statistics.topLiftExercises")}</p>
                <div className="mt-3 space-y-3">
                  {topLiftExercises.map((exercise) => (
                    <button
                      key={exercise.exerciseId ?? exercise.exerciseName}
                      type="button"
                      className={`w-full rounded-md border p-3 text-left transition ${
                        selectedLiftExerciseKeyValue === (exercise.exerciseId ?? exercise.exerciseName.toLowerCase())
                          ? "border-cyan-300 bg-cyan-300/15"
                          : "border-transparent bg-slate-900/80 hover:border-slate-600"
                      }`}
                      onClick={() =>
                        setSelectedLiftExerciseKey(exercise.exerciseId ?? exercise.exerciseName.toLowerCase())
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold text-slate-50">
                          {translateExerciseName(exercise, language)}
                        </p>
                        <span className="rounded-md bg-emerald-300 px-2 py-1 text-xs font-black text-emerald-950">
                          {formatKg(locale, exercise.volumeKg)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {t("statistics.setCount", {
                          count: exercise.sets,
                          plural: exercise.sets === 1 ? "" : "s",
                        })}{" "}
                        - {t("statistics.bestEstimatedShort")}{" "}
                        {formatKg(locale, exercise.bestEstimatedOneRepMaxKg, 1)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
                <p className="label">{t("statistics.formula")}</p>
                <p className="mt-2 text-sm text-slate-300">
                  {t("statistics.liftingFormulaNote", {
                    bodyWeight:
                      typeof latestBodyWeightKg === "number"
                        ? formatKg(locale, latestBodyWeightKg, 1)
                        : t("statistics.bodyWeightUnavailable"),
                  })}
                </p>
              </div>
            </aside>
          </div>
        )}

        {selectedLiftExercise && selectedLiftEntries.length > 0 ? (
          <div className="mt-5">
            <ExerciseTrendPanel
              buckets={selectedLiftBuckets}
              entries={selectedLiftEntries}
              exerciseName={translateExerciseName(selectedLiftExercise, language)}
              locale={locale}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
