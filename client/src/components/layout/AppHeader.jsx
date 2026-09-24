import { KeyRound, LogOut } from 'lucide-react';
import { Link } from 'react-router';

import { ROLE_LABELS, ROUTES } from '../../config/constants.js';
import { formatSchoolDate, todayDateKey } from '../../utils/date.js';
import { NotificationBell } from '../../features/notifications/components/NotificationBell.jsx';
import { LogoLink } from '../brand/Logo.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { buttonClasses } from '../ui/buttonStyles.js';

/**
 * Top bar: a light surface with Charleston text and icons and the thin Deep Blush line
 * underneath (the logo's dark green "Little" would disappear on a dark bar).
 * Phones: footprint mark, name, role and date, bell, avatar (opens the account sheet).
 * Desktop: today's date, bell, name and role, change password, log out.
 * (The page title is the page's own h1; repeating it here would say it twice.)
 */
export function AppHeader({ user, homeTo, onOpenAccount, onLogout, loggingOut }) {
  const roleLabel = ROLE_LABELS[user?.role] ?? user?.role;
  const today = todayDateKey();
  return (
    <header className="sticky top-0 z-20 border-b-3 border-cerise-400 bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex h-16 items-center gap-2 px-3 sm:px-5 lg:px-8">
        <LogoLink to={homeTo} variant="mark" markSize={36} className="p-1 lg:hidden" />
        {/* Phones: whose account this is (siblings share a phone), role and today's school date.
            Desktop: today's date here; the name and role sit on the right. */}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-bold text-ink lg:hidden">{user?.name}</p>
          <p className="truncate text-sm text-muted lg:hidden">
            {roleLabel} ·{' '}
            <time dateTime={today}>{formatSchoolDate(today, { weekday: true, year: false })}</time>
          </p>
          <p className="hidden lg:block">
            <span className="block text-xs font-semibold tracking-wide text-muted uppercase">
              Today
            </span>
            <time dateTime={today} className="font-bold text-brand-800">
              {formatSchoolDate(today, { weekday: true, year: false })}
            </time>
          </p>
        </div>

        <NotificationBell />

        {/* Phones and tablets: the avatar opens the account sheet. */}
        <button
          type="button"
          onClick={onOpenAccount}
          aria-label={`Account: ${user?.name}, ${roleLabel}`}
          className="grid size-11 place-items-center rounded-full lg:hidden"
        >
          <Avatar name={user?.name} size="md" />
        </button>

        {/* Desktop: everything visible. */}
        <div className="hidden items-center gap-3 lg:flex">
          <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
          <Avatar name={user?.name} size="md" />
          <div className="max-w-48 leading-tight">
            <p className="truncate font-bold text-ink">{user?.name}</p>
            <p className="text-sm text-muted">{roleLabel}</p>
          </div>
          <Link
            to={ROUTES.CHANGE_PASSWORD}
            aria-label="Change password"
            title="Change password"
            className={buttonClasses({ variant: 'ghost', size: 'icon' })}
          >
            <KeyRound aria-hidden="true" className="size-5" />
          </Link>
          <Button variant="secondary" icon={LogOut} onClick={onLogout} loading={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </Button>
        </div>
      </div>
    </header>
  );
}
