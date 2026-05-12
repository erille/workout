import { useCallback, useEffect, useState } from "react";
import { getSettings, saveSettings } from "../data/storage";
import { defaultSettings, type AppSettings } from "../models/settings";

export function useSettings(enabled = true) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getSettings()
      .then((loadedSettings) => {
        if (isMounted) {
          setSettings(loadedSettings);
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
  }, [enabled]);

  const updateSettings = useCallback(async (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    await saveSettings(nextSettings);
  }, []);

  return {
    settings,
    isLoading,
    updateSettings,
  };
}
