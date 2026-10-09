import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="h-18 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6">
      {/* Logo + nombre */}
      <Link to="/" className="flex items-center gap-2">
        <img
          src="/Logo.png"
          alt="Price Tracker"
          className="w-26 h-20 object-contain"
        />
        
      </Link>

      {/* Acciones de la derecha (temporal hasta 6.6) */}
      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="px-3 py-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Iniciar sesión
        </Link>
        <Link
          to="/register"
          className="px-4 py-1.5 text-sm bg-primary-container text-on-primary-container rounded-lg hover:bg-primary transition-colors shadow-sm"
        >
          Crear cuenta
        </Link>
      </div>
    </header>
  );
}