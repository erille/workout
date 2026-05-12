import { useCallback, useEffect, useState } from "react";
import {
  getAuthStatus,
  login as loginRequest,
  logout as logoutRequest,
  type AuthStatus,
} from "../services/authService";

const defaultStatus: AuthStatus = {
  authEnabled: false,
  authenticated: false,
};

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>(defaultStatus);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getAuthStatus()
      .then((nextStatus) => {
        if (isMounted) {
          setStatus(nextStatus);
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
  }, []);

  const login = useCallback(async (password: string) => {
    const nextStatus = await loginRequest(password);
    setStatus(nextStatus);
  }, []);

  const logout = useCallback(async () => {
    const nextStatus = await logoutRequest();
    setStatus(nextStatus);
  }, []);

  return {
    status,
    isLoading,
    login,
    logout,
  };
}
