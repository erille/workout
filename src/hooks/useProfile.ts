import { useCallback, useEffect, useState } from "react";
import { getProfile, saveProfile, type StorageMode } from "../data/storage";
import { defaultProfile, type CharacterProfile } from "../models/profile";

export function useProfile(mode: StorageMode, enabled = true) {
  const [profile, setProfile] = useState<CharacterProfile>(defaultProfile);
  const [loadedMode, setLoadedMode] = useState<StorageMode | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setIsLoading(true);

    getProfile(mode)
      .then((loadedProfile) => {
        if (isMounted) {
          setProfile(loadedProfile);
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

  const visibleProfile = loadedMode === mode ? profile : defaultProfile;

  const updateProfile = useCallback(
    async (nextProfile: CharacterProfile) => {
      const normalizedProfile = {
        ...nextProfile,
        updatedAt: new Date().toISOString(),
      };

      setProfile(normalizedProfile);
      setLoadedMode(mode);
      await saveProfile(normalizedProfile, mode);
    },
    [mode],
  );

  return {
    profile: visibleProfile,
    isLoading: enabled && (isLoading || loadedMode !== mode),
    updateProfile,
  };
}
