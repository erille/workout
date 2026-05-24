import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMusicPlayerSettings,
  saveMusicPlayerSettings,
} from "../../data/storage";
import { useI18n } from "../../i18n/I18nContext";

type MusicTrack = {
  id: string;
  title: string;
  url: string;
};

type MusicPlaylistResponse = {
  tracks: MusicTrack[];
};

type MusicPlayerProps = {
  enabled: boolean;
};

function volumeIcon(volume: number) {
  if (volume <= 0) {
    return <VolumeX aria-hidden="true" size={16} />;
  }

  if (volume < 0.5) {
    return <Volume1 aria-hidden="true" size={16} />;
  }

  return <Volume2 aria-hidden="true" size={16} />;
}

async function loadMusicTracks(): Promise<MusicTrack[]> {
  const response = await fetch("/api/music", { credentials: "same-origin" });

  if (!response.ok) {
    throw new Error(`Unable to load music: ${response.status}`);
  }

  const payload = (await response.json()) as MusicPlaylistResponse;

  return Array.isArray(payload.tracks) ? payload.tracks : [];
}

export function MusicPlayer({ enabled }: MusicPlayerProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumePanelRef = useRef<HTMLDivElement>(null);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [volumePanelPosition, setVolumePanelPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const currentTrack = tracks[currentIndex];

  useEffect(() => {
    let isMounted = true;

    getMusicPlayerSettings().then((settings) => {
      if (isMounted) {
        setVolume(settings.volume);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setTracks([]);
      setIsPlaying(false);
      return undefined;
    }

    let isMounted = true;

    Promise.all([loadMusicTracks(), getMusicPlayerSettings()])
      .then(([loadedTracks, savedSettings]) => {
        if (!isMounted) {
          return;
        }

        setTracks(loadedTracks);
        const savedIndex = loadedTracks.findIndex((track) => track.id === savedSettings.trackId);
        setCurrentIndex(savedIndex >= 0 ? savedIndex : 0);
        setVolume(savedSettings.volume);
      })
      .catch(() => {
        if (isMounted) {
          setTracks([]);
          setIsPlaying(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.volume = volume;
    }

    if (currentTrack) {
      void saveMusicPlayerSettings({
        volume,
        trackId: currentTrack.id,
      });
    }
  }, [currentTrack?.id, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack || !isPlaying) {
      return;
    }

    void audio.play().catch(() => setIsPlaying(false));
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!isVolumeOpen) {
      return undefined;
    }

    const positionVolumePanel = () => {
      const button = volumeButtonRef.current;

      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const panelWidth = 72;
      const panelHeight = 150;
      const gap = 8;
      const preferredTop = rect.bottom + gap;
      const top =
        preferredTop + panelHeight <= window.innerHeight
          ? preferredTop
          : Math.max(gap, rect.top - panelHeight - gap);
      const left = Math.min(
        window.innerWidth - panelWidth - gap,
        Math.max(gap, rect.left + rect.width / 2 - panelWidth / 2),
      );

      setVolumePanelPosition({ left, top });
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        !volumePanelRef.current?.contains(target) &&
        !volumeButtonRef.current?.contains(target)
      ) {
        setIsVolumeOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsVolumeOpen(false);
      }
    };

    positionVolumePanel();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", positionVolumePanel);
    window.addEventListener("scroll", positionVolumePanel, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", positionVolumePanel);
      window.removeEventListener("scroll", positionVolumePanel, true);
    };
  }, [isVolumeOpen]);

  const hasMultipleTracks = tracks.length > 1;
  const playerWidthClass = hasMultipleTracks ? "w-52 lg:w-56" : "w-40 lg:w-44";
  const volumeLabel = useMemo(() => Math.round(volume * 100), [volume]);

  const goToTrack = (nextIndex: number) => {
    if (tracks.length === 0) {
      return;
    }

    setCurrentIndex((nextIndex + tracks.length) % tracks.length);
  };

  const playCurrentTrack = () => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    void audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const togglePlayback = () => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    playCurrentTrack();
  };

  if (!enabled || tracks.length === 0 || !currentTrack) {
    return null;
  }

  return (
    <div
      className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-slate-800 bg-slate-900/70 px-2 text-slate-300 ${playerWidthClass}`}
    >
      <audio
        ref={audioRef}
        src={currentTrack.url}
        preload="metadata"
        onEnded={() => {
          if (hasMultipleTracks) {
            setIsPlaying(true);
            goToTrack(currentIndex + 1);
            return;
          }

          setIsPlaying(false);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      {hasMultipleTracks ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-50"
          aria-label={t("music.previous")}
          onClick={() => goToTrack(currentIndex - 1)}
        >
          <SkipBack aria-hidden="true" size={16} />
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-400 text-slate-950 transition hover:bg-cyan-300"
        aria-label={isPlaying ? t("music.pause") : t("music.play")}
        onClick={togglePlayback}
      >
        {isPlaying ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
      </button>
      {hasMultipleTracks ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-50"
          aria-label={t("music.next")}
          onClick={() => goToTrack(currentIndex + 1)}
        >
          <SkipForward aria-hidden="true" size={16} />
        </button>
      ) : null}
      <span className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-slate-200">
        {currentTrack.title}
      </span>
      <div ref={volumePanelRef} className="relative shrink-0">
        <button
          ref={volumeButtonRef}
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-50"
          aria-label={t("music.volume", { value: volumeLabel })}
          aria-expanded={isVolumeOpen}
          onClick={() => setIsVolumeOpen((current) => !current)}
        >
          {volumeIcon(volume)}
        </button>
        {isVolumeOpen && volumePanelPosition ? (
          <div
            className="fixed z-50 flex flex-col items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-3 shadow-2xl"
            style={{
              left: `${volumePanelPosition.left}px`,
              top: `${volumePanelPosition.top}px`,
            }}
          >
            <input
              className="h-24 w-6 accent-cyan-300"
              min={0}
              max={1}
              step={0.01}
              type="range"
              value={volume}
              aria-label={t("music.volume", { value: volumeLabel })}
              onChange={(event) => setVolume(Number(event.target.value))}
              style={{ writingMode: "vertical-lr", direction: "rtl" }}
            />
            <span className="text-xs font-bold text-cyan-100">{volumeLabel}%</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
