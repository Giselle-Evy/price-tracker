import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Header simple */}
      <header className="w-full py-5 px-6 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/Logo.png"
            alt="Price Tracker"
            className="w-9 h-9 object-contain"
          />
          <span className="font-semibold text-lg text-on-surface tracking-tight">
            Price<span className="text-primary-container">Tracker</span>
          </span>
        </Link>

        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </header>

      {/* Contenido centrado */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-outline">
        © 2025 PriceTracker Inc. Acceso cifrado SSL 256-bit.
      </footer>
    </div>
  );
}