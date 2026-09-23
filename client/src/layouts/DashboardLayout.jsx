import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { Spinner } from '../components/ui/Spinner.jsx';
import { APP_NAME, NAV_ITEMS, ROUTES } from '../config/constants.js';

/** Shared shell for admin / teacher / student areas. Sidebar on desktop, drawer on mobile. */
export default function DashboardLayout({ role }) {
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS[role] ?? [];

  return (
    <div className="min-h-dvh lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center px-5">
          <Link to={ROUTES.HOME} className="text-xl font-extrabold text-brand-700">
            {APP_NAME}
          </Link>
        </div>
        <p className="px-5 pb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
          {role}
        </p>
        <nav className="flex flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 font-semibold ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          {/* TODO(auth/notifications): user menu + notification bell with unread count */}
          <div className="ml-auto" />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
