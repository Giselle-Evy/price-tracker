import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, UserRound } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

type Props = {
  onOpenNavigation: () => void;
  navigationOpen: boolean;
};

export default function Header({ onOpenNavigation, navigationOpen }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 sm:px-6">
      <Link to="/" className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-sm font-bold tracking-tight text-on-primary-container"
        >
          PT
        </span>
        <span className="hidden text-lg font-semibold tracking-tight text-on-surface min-[420px]:inline">
          Price<span className="text-primary">Tracker</span>
        </span>
      </Link>

      {user ? (
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-4">
          <button
            type="button"
            onClick={onOpenNavigation}
            aria-label={navigationOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-controls="primary-navigation"
            aria-expanded={navigationOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-primary md:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <span className="hidden text-sm text-on-surface-variant sm:inline">
            Hola, <strong className="text-on-surface">{user.name || user.email}</strong>
          </span>
          <Link
            to="/profile"
            aria-label="Mi perfil"
            title="Mi perfil"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            <UserRound aria-hidden="true" className="h-[18px] w-[18px]" />
          </Link>
          <button
            onClick={handleLogout}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-on-surface-variant transition-colors hover:bg-error-container/50 hover:text-error sm:px-3"
            title="Cerrar sesión"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenNavigation}
            aria-label={navigationOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-controls="primary-navigation"
            aria-expanded={navigationOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-primary md:hidden"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <Link
            to="/login"
            className="rounded-lg px-3 py-2 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span className="sm:hidden">Entrar</span>
            <span className="hidden sm:inline">Iniciar sesión</span>
          </Link>
          <Link
            to="/register"
            className="whitespace-nowrap rounded-lg bg-primary-container px-3 py-2 text-sm font-medium text-on-primary-container shadow-sm transition-colors hover:bg-primary-container/90 sm:px-4"
          >
            Crear cuenta
          </Link>
        </div>
      )}
    </header>
  );
}