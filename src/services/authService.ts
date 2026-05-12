export type AuthStatus = {
  authEnabled: boolean;
  authenticated: boolean;
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
    return await authRequest<AuthStatus>("/api/auth/status");
  } catch {
    return {
      authEnabled: false,
      authenticated: true,
    };
  }
}

export async function login(password: string): Promise<AuthStatus> {
  return authRequest<AuthStatus>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<AuthStatus> {
  return authRequest<AuthStatus>("/api/auth/logout", {
    method: "POST",
  });
}
