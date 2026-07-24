import { useCallback, useEffect, useState } from "react";
import {
  getAuthStatus,
  login as loginRequest,
  logout as logoutRequest,
  type AuthStatus,
} from "../services/authService";

const defaultStatus: AuthStatus = {
  apiAvailable: false,
  authEnabled: false,
  authenticated: false,
  user: null,
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

  const login = useCallback(async (loginName: string, password: string) => {
    const nextStatus = await loginRequest(loginName, password);
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
