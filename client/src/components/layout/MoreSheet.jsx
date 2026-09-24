import { ArrowLeftRight, KeyRound, LogOut } from 'lucide-react';
import { Link, NavLink } from 'react-router';

import { ROLE_LABELS, ROUTES } from '../../config/constants.js';
import { cn } from '../../utils/cn.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Drawer } from '../ui/Drawer.jsx';

const rowClasses = 'flex min-h-12 items-center gap-3 rounded-control px-3 font-semibold';

/**
 * Phones: the nav items not in the bottom bar, plus the account (name, role, password, log out).
 * `switchChild` ({ onClick, label }, guardians only) logs out and opens the child chooser.
 */
export function MoreSheet({ open, onClose, items, user, onLogout, switchChild, loggingOut }) {
  const secondary = items.filter((item) => !item.primary);
  return (
    <Drawer side="bottom" open={open} onClose={onClose} title="Menu">
      <div className="flex items-center gap-3 rounded-card bg-blush-50 p-3">
        <Avatar name={user?.name} size="lg" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-bold">{user?.name}</p>
          <p className="text-muted">{ROLE_LABELS[user?.role] ?? user?.role}</p>
        </div>
      </div>

      {secondary.length > 0 && (
        <nav aria-label="More pages" className="mt-3">
          <ul className="flex flex-col gap-1">
            {secondary.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      rowClasses,
                      isActive ? 'bg-brand-100 text-brand-800' : 'text-ink hover:bg-blush-50',
                    )
                  }
                >
                  <item.icon aria-hidden="true" className="size-5 text-brand-700" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
        <Link
          to={ROUTES.CHANGE_PASSWORD}
          onClick={onClose}
          className={cn(rowClasses, 'text-ink hover:bg-blush-50')}
        >
          <KeyRound aria-hidden="true" className="size-5 text-brand-700" />
          Change password
        </Link>
        {switchChild && (
          <Button
            variant="secondary"
            icon={ArrowLeftRight}
            onClick={switchChild.onClick}
            disabled={loggingOut}
            fullWidth
          >
            {switchChild.label}
          </Button>
        )}
        <Button variant="secondary" icon={LogOut} onClick={onLogout} loading={loggingOut} fullWidth>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </Button>
      </div>
    </Drawer>
  );
}
