import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';

import { AppHeader } from '../components/layout/AppHeader.jsx';
import { BottomNav } from '../components/layout/BottomNav.jsx';
import { MoreSheet } from '../components/layout/MoreSheet.jsx';
import { activeNavItem } from '../components/layout/navMatch.js';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { Skeleton, SkeletonCard } from '../components/ui/Skeleton.jsx';
import { NAV_ITEMS, ROLE_HOME, ROLES, ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';
import { usePrefetchDashboard } from '../features/dashboard/hooks/useDashboard.js';
import { useRealtimeInvalidation } from '../features/notifications/hooks/useRealtimeInvalidation.js';
import { SWITCH_CHILD_LOGIN } from '../features/student/hooks/useSwitchChild.js';
import { text as studentText } from '../features/student/text/index.js';

const COLLAPSED_KEY = 'littlesteps.sidebar.collapsed';

// A per-device preference only; storage may be unavailable (private mode), so never required.
function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/**
 * Shell for the admin / teacher / student areas: collapsible sidebar on desktop, bottom
 * navigation plus a "More" sheet on phones, and a light header with the bell and account.
 */
export default function DashboardLayout({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [moreOpen, setMoreOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Pushed notifications refresh the data they are about (dashboards stay live).
  useRealtimeInvalidation();
  // On the home page, fetch its data while the page's code downloads (slow networks). The
  // admin home doesn't read the dashboard yet, so it is left out.
  usePrefetchDashboard(role, role !== ROLES.ADMIN && pathname === ROLE_HOME[role]);

  const items = NAV_ITEMS[role] ?? [];
  const homeTo = ROLE_HOME[role];
  const active = activeNavItem(items, pathname);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Not saved; the sidebar still toggles for this visit.
    }
  };

  const signOut = (to) => async () => {
    setLoggingOut(true);
    await logout();
    navigate(to, { replace: true });
  };
  const onLogout = signOut(ROUTES.LOGIN);
  // Guardians on a shared phone: log out and pick another child on the login page.
  const switchChild =
    role === ROLES.STUDENT
      ? { onClick: signOut(SWITCH_CHILD_LOGIN), label: studentText.switchChild.action }
      : undefined;

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-brand-800 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>

      <Sidebar items={items} homeTo={homeTo} collapsed={collapsed} onToggle={toggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          homeTo={homeTo}
          onOpenAccount={() => setMoreOpen(true)}
          onLogout={onLogout}
          switchChild={switchChild}
          loggingOut={loggingOut}
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] focus:outline-none sm:px-6 lg:px-8 lg:pb-10"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <BottomNav
        items={items}
        onMore={() => setMoreOpen(true)}
        moreActive={moreOpen || Boolean(active && !active.primary)}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={items}
        user={user}
        onLogout={onLogout}
        switchChild={switchChild}
        loggingOut={loggingOut}
      />
    </div>
  );
}
