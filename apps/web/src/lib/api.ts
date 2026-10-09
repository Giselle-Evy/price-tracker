const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type ApiError = {
  error: string;
  details?: Record<string, string[]>;
  status: number;
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Si la respuesta no es JSON (ej: error de red), lanzamos error genérico
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw {
      error: 'Error de conexión con el servidor',
      status: response.status,
    } as ApiError;
  }

  if (!response.ok) {
    const apiError: ApiError = {
      error: (data as { error?: string }).error || 'Error desconocido',
      details: (data as { details?: Record<string, string[]> }).details,
      status: response.status,
    };
    throw apiError;
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, token?: string | null) =>
    request<T>(endpoint, { method: 'GET' }, token),

  post: <T>(endpoint: string, body: unknown, token?: string | null) =>
    request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token
    ),

  patch: <T>(endpoint: string, body: unknown, token?: string | null) =>
    request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
      token
    ),

  delete: <T>(endpoint: string, token?: string | null) =>
    request<T>(endpoint, { method: 'DELETE' }, token),
};