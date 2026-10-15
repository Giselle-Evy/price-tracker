import {
  Activity,
  Code2,
  ChevronLeft,
  ChevronRight,
  X,
  FileCode2,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

const primaryItems: NavItem[] = [
  { to: '/', label: 'Ofertas', icon: Newspaper, end: true },
  { to: '/monitors', label: 'Mis seguimientos', icon: Activity },
];

const scrapingItems: NavItem[] = [
  { to: '/configs', label: 'Configuraciones', icon: FileCode2 },
  { to: '/builder', label: 'Constructor', icon: Code2 },
];

function NavigationLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={() => {
        onNavigate();
      }}
      aria-label={item.label}
      className={({ isActive }: { isActive: boolean }) =>
        `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-primary md:w-full ${
          isActive
            ? 'bg-surface-container-high font-semibold text-primary'
            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
        } ${collapsed ? 'md:justify-center md:px-0' : ''}`
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
      <span className={`whitespace-nowrap md:transition-opacity ${collapsed ? 'md:hidden' : ''}`}>
        {item.label}
      </span>
    </NavLink>
  );
}

type Props = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: Props) {
  const navItems = [...primaryItems, ...scrapingItems];

  return (
    <aside
      className={`fixed inset-y-16 left-0 z-30 w-64 border-r border-outline-variant bg-surface-container-lowest transition-[width,transform] duration-200 ease-out md:static md:inset-y-auto md:z-auto md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'md:w-[76px]' : 'md:w-60'}`}
    >
      <div className="flex h-full flex-col px-3 py-4 md:px-3 md:py-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <p
            className={`px-2 text-xs font-semibold uppercase tracking-[0.12em] text-outline ${
              collapsed ? 'md:hidden' : ''
            }`}
          >
            Navegación
          </p>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar navegación"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-primary md:hidden"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir navegación' : 'Contraer navegación'}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-primary md:flex"
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            ) : (
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav
          id="primary-navigation"
          aria-label="Navegación principal"
          className="flex flex-col gap-1"
        >
          {navItems.map((item, index) => (
            <div key={item.to}>
              {index === primaryItems.length && (
                <>
                  <div
                    aria-hidden="true"
                    className="mx-2 my-3 h-px bg-outline-variant"
                  />
                  <p
                    className={`px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-outline ${
                      collapsed ? 'md:hidden' : ''
                    }`}
                  >
                    Herramientas
                  </p>
                </>
              )}
              <NavigationLink
                item={item}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
              />
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
