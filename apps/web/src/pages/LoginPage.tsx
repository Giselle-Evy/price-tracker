import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: conectar con el backend en el sub-paso 6.7
    console.log('Login submit:', { email, password });
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6">
      {/* Card principal */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-md p-8 sm:p-10 flex flex-col">
        {/* Header del card */}
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            Price<span className="text-primary-container">Tracker</span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-2 max-w-xs">
            Bienvenido de vuelta. Ingresa a tu panel de monitoreo y scraping.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-on-surface flex items-center justify-between"
            >
              <span>Correo electrónico</span>
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
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-on-surface"
              >
                Contraseña
              </label>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-11 py-2.5 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:shadow-md transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 text-secondary hover:text-on-surface p-1 transition-colors"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Botón submit */}
          <button
            type="submit"
            className="w-full py-2.5 px-6 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <span>Iniciar sesión</span>
          </button>
        </form>

        {/* Footer del card */}
        <div className="mt-6 pt-4 text-center border-t border-surface-container">
          <span className="text-xs text-on-surface-variant">
            ¿Aún no tienes cuenta?{' '}
          </span>
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