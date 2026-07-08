export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}

export interface ApiError {
  error: string;
}

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestError('Invalid response from server', response.status);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await parseJson<T & ApiError>(response);

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data && data.error
        ? data.error
        : 'Request failed';
    throw new ApiRequestError(message, response.status);
  }

  return data;
}

export const authApi = {
  signup: (body: { email: string; password: string; name: string }) =>
    apiRequest<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    apiRequest<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  me: () => apiRequest<AuthResponse>('/api/auth/me'),
};
