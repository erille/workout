export type AuthUser = {
  id: string;
  login: string;
};

export type AuthStatus = {
  apiAvailable: boolean;
  authEnabled: boolean;
  authenticated: boolean;
  user: AuthUser | null;
};

async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(String(response.status));
  }

  return response.json() as Promise<T>;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  try {
    const status = await authRequest<Omit<AuthStatus, "apiAvailable">>("/api/auth/status");
    return {
      ...status,
      apiAvailable: true,
    };
  } catch {
    return {
      apiAvailable: false,
      authEnabled: false,
      authenticated: true,
      user: null,
    };
  }
}

export async function login(login: string, password: string): Promise<AuthStatus> {
  const status = await authRequest<Omit<AuthStatus, "apiAvailable">>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
  return {
    ...status,
    apiAvailable: true,
  };
}

export async function logout(): Promise<AuthStatus> {
  const status = await authRequest<Omit<AuthStatus, "apiAvailable">>("/api/auth/logout", {
    method: "POST",
  });
  return {
    ...status,
    apiAvailable: true,
  };
}
