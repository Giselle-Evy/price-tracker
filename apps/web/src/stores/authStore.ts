import { create } from 'zustand';
import { api, type ApiError } from '../lib/api';

export type User = {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
};

type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
};

const STORAGE_KEY = 'price-tracker-auth';

// Cargar estado inicial desde localStorage
function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw) as {
      user: User | null;
      accessToken: string | null;
      refreshToken: string | null;
    };
    return parsed;
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

const initial = loadInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user,
  accessToken: initial.accessToken,
  refreshToken: initial.refreshToken,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/auth/login', { email, password });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        })
      );

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const error = err as ApiError;
      set({ isLoading: false, error: error.error || 'Error al iniciar sesión' });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/auth/register', {
        name,
        email,
        password,
      });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        })
      );

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const error = err as ApiError;
      set({ isLoading: false, error: error.error || 'Error al registrarse' });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));