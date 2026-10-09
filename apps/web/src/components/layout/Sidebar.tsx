import { NavLink } from 'react-router-dom';

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '/icons/casa.png' },
  { to: '/dashboard', label: 'Dashboard', icon: '/icons/dashboard.png' },
  { to: '/monitors', label: 'Monitoreados', icon: '/icons/monitoreados.png' },
  { to: '/builder', label: 'Constructor', icon: '/icons/constructor.png' },
  { to: '/profile', label: 'Perfil', icon: '/icons/perfil.png' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-surface-container-lowest border-r border-outline-variant flex flex-col">
      <nav className="flex-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-secondary-container text-on-secondary-container font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`
            }
          >
            <img
              src={item.icon}
              alt=""
              className="w-5 h-5 object-contain"
            />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-outline-variant">
        <p className="text-xs text-outline text-center">
          v0.1.0 — En desarrollo
        </p>
      </div>
    </aside>
  );
}