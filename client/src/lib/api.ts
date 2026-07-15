import type {
  ActivitySlot,
  BudgetSummary,
  DestinationOption,
  ExpenseInput,
  SharedTripData,
  Trip,
  TripExpense,
  TripPreferences,
  TripSummary,
} from './types';

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
  /** Parsed error payload, when the server sent one (e.g. { tripId }). */
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
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
    throw new ApiRequestError(message, response.status, data);
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

export const tripsApi = {
  list: () => apiRequest<{ trips: TripSummary[] }>('/api/trips'),

  get: (id: string) => apiRequest<{ trip: Trip }>(`/api/trips/${id}`),

  duplicate: (id: string) =>
    apiRequest<{ trip: Trip }>(`/api/trips/${id}/duplicate`, { method: 'POST' }),

  activate: (id: string) =>
    apiRequest<{ trip: Trip }>(`/api/trips/${id}/activate`, { method: 'POST' }),

  /** The PDF is stored server-side; this returns a short-lived signed URL. */
  exportPdf: (id: string) =>
    apiRequest<{ url: string; filename: string; reused: boolean }>(
      `/api/trips/${id}/export-pdf`,
    ),

  share: (id: string) =>
    apiRequest<{ shareToken: string; shareUrl: string }>(`/api/trips/${id}/share`, {
      method: 'POST',
    }),

  unshare: (id: string) =>
    apiRequest<{ message: string }>(`/api/trips/${id}/share`, { method: 'DELETE' }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/api/trips/${id}`, { method: 'DELETE' }),

  regenerateActivity: (id: string, dayNumber: number, slot: ActivitySlot) =>
    apiRequest<{ trip: Trip }>(`/api/trips/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ dayNumber, slot }),
    }),

  regenerateRestaurant: (id: string, dayNumber: number, restaurantIndex: number) =>
    apiRequest<{ trip: Trip }>(`/api/trips/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ dayNumber, slot: 'restaurant', restaurantIndex }),
    }),
};

export const expensesApi = {
  list: (tripId: string) =>
    apiRequest<{ expenses: TripExpense[] }>(`/api/trips/${tripId}/expenses`),

  create: (tripId: string, input: ExpenseInput) =>
    apiRequest<{ expense: TripExpense }>(`/api/trips/${tripId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (tripId: string, expenseId: string, input: ExpenseInput) =>
    apiRequest<{ expense: TripExpense }>(`/api/trips/${tripId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  remove: (tripId: string, expenseId: string) =>
    apiRequest<{ message: string }>(`/api/trips/${tripId}/expenses/${expenseId}`, {
      method: 'DELETE',
    }),
};

export const budgetApi = {
  summary: (tripId: string, currency: string) =>
    apiRequest<BudgetSummary>(`/api/trips/${tripId}/budget?currency=${encodeURIComponent(currency)}`),

  currencies: () =>
    apiRequest<{ currencies: Record<string, string> }>('/api/currency/currencies'),
};

/** Public shared-link API — authorized purely by the token, no login. */
export const sharedApi = {
  get: (token: string) => apiRequest<{ trip: SharedTripData }>(`/api/shared/${token}`),

  listExpenses: (token: string) =>
    apiRequest<{ expenses: TripExpense[] }>(`/api/shared/${token}/expenses`),

  createExpense: (token: string, input: ExpenseInput) =>
    apiRequest<{ expense: TripExpense }>(`/api/shared/${token}/expenses`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  removeExpense: (token: string, expenseId: string) =>
    apiRequest<{ message: string }>(`/api/shared/${token}/expenses/${expenseId}`, {
      method: 'DELETE',
    }),

  summary: (token: string, currency: string) =>
    apiRequest<BudgetSummary>(`/api/shared/${token}/budget?currency=${encodeURIComponent(currency)}`),
};

export const generateApi = {
  destinations: (preferences: TripPreferences, exclude: string[] = []) =>
    apiRequest<{ options: DestinationOption[] }>('/api/generate/destinations', {
      method: 'POST',
      body: JSON.stringify({ preferences, exclude }),
    }),

  itinerary: (preferences: TripPreferences) =>
    apiRequest<{ trip: Trip }>('/api/generate/itinerary', {
      method: 'POST',
      body: JSON.stringify({ preferences }),
    }),

  retryItinerary: (tripId: string) =>
    apiRequest<{ trip: Trip }>('/api/generate/itinerary', {
      method: 'POST',
      body: JSON.stringify({ tripId }),
    }),
};
