import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  CheckCircle2,
  XCircle,
  Info,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

import { useAuthStore } from '../stores/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordStrength = (() => {
    if (!password) return { score: 0, label: 'Sin escribir', color: 'text-outline' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score, label: 'Débil', color: 'text-error' };
    if (score === 2) return { score, label: 'Aceptable', color: 'text-tertiary' };
    if (score === 3) return { score, label: 'Buena', color: 'text-primary' };
    return { score, label: 'Robusta y Segura', color: 'text-primary-container' };
  })();

  const passwordsMatch = confirmPassword && password === confirmPassword;
  const passwordsMismatch = confirmPassword && password !== confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();

    if (password !== confirmPassword) {
      return;
    }

    try {
      await register(name, email, password);
      navigate('/');
    } catch {
      // El error ya está en el store
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-md p-8 sm:p-10 flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            Price<span className="text-primary-container">Tracker</span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-4 max-w-md">
            Crea tu cuenta profesional para comenzar a monitorear precios en tiempo real.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nombre */}
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-semibold text-on-surface flex items-center justify-between">
              <span>Nombre de usuario</span>
              <span className="text-on-surface-variant text-xs font-normal">Obligatorio</span>
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. carlos_mendez"
                required
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-semibold text-on-surface flex items-center justify-between">
              <span>Correo electrónico</span>
              <span className="text-on-surface-variant text-xs font-normal">Obligatorio</span>
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
            <label htmlFor="password" className="text-xs font-semibold text-on-surface flex items-center justify-between">
              <span>Contraseña</span>
              <span className="text-on-surface-variant text-xs font-normal">Min. 8 caracteres</span>
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

            {/* Medidor de fortaleza */}
            <div className="mt-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Seguridad de la clave:</span>
                <span className={`text-xs font-semibold ${passwordStrength.color}`}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full rounded-full overflow-hidden bg-surface-container">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-full rounded-full transition-colors duration-200 ${
                      i <= passwordStrength.score
                        ? passwordStrength.score <= 1
                          ? 'bg-error'
                          : passwordStrength.score === 2
                            ? 'bg-tertiary'
                            : 'bg-primary-container'
                        : 'bg-surface-container'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password" className="text-xs font-semibold text-on-surface">
              Confirmar contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="w-full pl-10 pr-11 py-2.5 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 text-secondary hover:text-on-surface p-1 transition-colors"
                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs min-h-[20px]">
              {!confirmPassword && (
                <>
                  <Info className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span className="text-on-surface-variant">
                    Introduce de nuevo la contraseña para validar coincidencia
                  </span>
                </>
              )}
              {passwordsMatch && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary-container" />
                  <span className="text-primary-container font-semibold">
                    Las contraseñas coinciden correctamente
                  </span>
                </>
              )}
              {passwordsMismatch && (
                <>
                  <XCircle className="w-3.5 h-3.5 text-error" />
                  <span className="text-error font-semibold">
                    Las contraseñas no coinciden
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Botón submit */}
          <button
            type="submit"
            disabled={isLoading || !passwordsMatch}
            className="w-full py-3 px-6 mt-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-base flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? 'Creando cuenta...' : 'Crear cuenta'}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 text-center border-t border-surface-container flex items-center justify-center gap-1">
          <span className="text-sm text-on-surface-variant">¿Ya tienes una cuenta activa?</span>
          <Link
            to="/login"
            className="text-sm font-semibold text-primary-container hover:text-primary transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}