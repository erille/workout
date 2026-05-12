import { useCallback, useEffect, useState } from "react";
import { getSettings, saveSettings, type StorageMode } from "../data/storage";
import { defaultSettings, type AppSettings } from "../models/settings";

export function useSettings(mode: StorageMode, enabled = true) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loadedMode, setLoadedMode] = useState<StorageMode | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getSettings(mode)
      .then((loadedSettings) => {
        if (isMounted) {
          setSettings(loadedSettings);
          setLoadedMode(mode);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, mode]);

  const visibleSettings = loadedMode === mode ? settings : defaultSettings;

  const updateSettings = useCallback(async (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    setLoadedMode(mode);
    await saveSettings(nextSettings, mode);
  }, [mode]);

  return {
    settings: visibleSettings,
    isLoading: enabled && (isLoading || loadedMode !== mode),
    updateSettings,
  };
}
