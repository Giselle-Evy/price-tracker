import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      navigate('/');
    } catch {
      // El error ya está en el store
    }
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6">
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-md p-8 sm:p-10 flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            Price<span className="text-primary-container">Tracker</span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-2 max-w-xs">
            Bienvenido de vuelta. Ingresa a tu panel de monitoreo y scraping.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-semibold text-on-surface">
              Correo electrónico
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@empresa.com"
                required
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-semibold text-on-surface">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="w-full pl-10 pr-11 py-2.5 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 text-secondary hover:text-on-surface p-1 transition-colors"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botón submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-6 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}</span>
            {!isLoading && (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 text-center border-t border-surface-container">
          <span className="text-xs text-on-surface-variant">¿Aún no tienes cuenta? </span>
          <Link
            to="/register"
            className="text-xs font-semibold text-primary-container hover:text-primary transition-colors"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}