import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function Header() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="h-16 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6">
      <Link to="/" className="flex items-center gap-2">
        
        <span className="font-semibold text-lg text-on-surface tracking-tight">
          Price<span className="text-primary-container">Tracker</span>
        </span>
      </Link>

      {user ? (
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">
            Hola, <strong className="text-on-surface">{user.name || user.email}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-on-surface-variant hover:text-error transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      ) : (
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
      )}
    </header>
  );
}