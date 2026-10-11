const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export type ApiError = {
  error: string;
  details?: Record<string, string[]>;
  status: number;
};

// ─────────────────────────────────────────────────────────────
// CALLBACKS DE AUTH
// El store los registra al inicializarse para evitar dependencia
// circular entre api.ts y authStore.ts.
// ─────────────────────────────────────────────────────────────

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthCallbacks = {
  getTokens: () => { accessToken: string | null; refreshToken: string | null };
  setTokens: (tokens: TokenPair) => void;
  onAuthFailure: () => void;
};

let authCallbacks: AuthCallbacks | null = null;

export function registerAuthCallbacks(callbacks: AuthCallbacks) {
  authCallbacks = callbacks;
}

// ─────────────────────────────────────────────────────────────
// REFRESH SINGLETON (evita N refresh concurrentes)
// ─────────────────────────────────────────────────────────────

let refreshPromise: Promise<TokenPair> | null = null;

async function refreshTokens(): Promise<TokenPair> {
  if (!authCallbacks) {
    throw {
      error: 'Auth no inicializado',
      status: 500,
    } as ApiError;
  }

  const { refreshToken } = authCallbacks.getTokens();

  if (!refreshToken) {
    throw {
      error: 'No hay refresh token',
      status: 401,
    } as ApiError;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw {
      error: 'Refresh token inválido o expirado',
      status: response.status,
    } as ApiError;
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken?: string;
  };

  const tokens: TokenPair = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? refreshToken,
  };

  authCallbacks.setTokens(tokens);
  return tokens;
}

// Si ya hay un refresh en curso, todos los requests esperan al mismo.
function getRefreshedTokens(): Promise<TokenPair> {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ─────────────────────────────────────────────────────────────
// REQUEST PRINCIPAL
// ─────────────────────────────────────────────────────────────

type RequestOptions = RequestInit & {
  /** Evita intentar refresh si la request ES un refresh o login/register. */
  skipAuthRefresh?: boolean;
};

async function rawRequest(
  endpoint: string,
  options: RequestOptions,
  token: string | null
): Promise<{ data: unknown; response: Response }> {
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

  let data: unknown = null;

  if (response.status !== 204) {
    const text = await response.text();

    if (text.length > 0) {
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(text);
        } catch {
          throw {
            error: 'Respuesta inválida del servidor',
            status: response.status,
          } as ApiError;
        }
      } else {
        data = text;
      }
    }
  }

  return { data, response };
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
  token?: string | null
): Promise<T> {
  let currentToken = token ?? null;

  // Primer intento
  const first = await rawRequest(endpoint, options, currentToken);

  // Si NO es 401, o si la request está marcada como skipAuthRefresh, devolvemos/tiramos según ok.
  if (
    first.response.ok ||
    first.response.status !== 401 ||
    options.skipAuthRefresh
  ) {
    if (!first.response.ok) {
      const errorData = first.data as
        | { error?: string; details?: Record<string, string[]> }
        | null;

      throw {
        error: errorData?.error || `Error ${first.response.status}`,
        details: errorData?.details,
        status: first.response.status,
      } as ApiError;
    }
    return first.data as T;
  }

  // Llegó 401 → intentamos refresh
  let refreshed: TokenPair;
  try {
    refreshed = await getRefreshedTokens();
  } catch (refreshErr) {
    // El refresh falló → cerramos sesión
    if (authCallbacks) authCallbacks.onAuthFailure();
    throw refreshErr as ApiError;
  }

  // Reintentamos con el nuevo access token
  currentToken = refreshed.accessToken;
  const second = await rawRequest(endpoint, options, currentToken);

  if (!second.response.ok) {
    const errorData = second.data as
      | { error?: string; details?: Record<string, string[]> }
      | null;

    throw {
      error: errorData?.error || `Error ${second.response.status}`,
      details: errorData?.details,
      status: second.response.status,
    } as ApiError;
  }

  return second.data as T;
}

// ─────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────

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