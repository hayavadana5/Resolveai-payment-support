const TOKEN_KEY = 'resolveai.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    tokenStore.clear();
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    throw new ApiError(401, 'Your session has expired. Sign in again.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, (payload as { error?: string }).error ?? 'That request could not be completed.');
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};
