import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import Header from './Header';
import Sidebar from './Sidebar';

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavigationOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavigationOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavigationOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header
        onOpenNavigation={() => setMobileNavigationOpen((open) => !open)}
        navigationOpen={mobileNavigationOpen}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {mobileNavigationOpen && (
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setMobileNavigationOpen(false)}
            className="fixed inset-x-0 bottom-0 top-16 z-20 bg-black/60 md:hidden"
          />
        )}
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileNavigationOpen}
          onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onCloseMobile={() => setMobileNavigationOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-auto bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}