import { Ellipsis } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '../../utils/cn.js';

const itemClasses = (active) =>
  cn(
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-semibold transition-colors',
    active ? 'text-brand-800' : 'text-sand-600 hover:text-ink',
  );

const Pill = ({ icon: Icon, active }) => (
  <span
    className={cn(
      'grid h-7 w-14 place-items-center rounded-full transition-colors',
      active && 'bg-brand-100',
    )}
  >
    <Icon aria-hidden="true" className="size-5" />
  </span>
);

/**
 * Phone and tablet navigation (below lg): the role's primary items plus "More", which opens
 * the sheet with the other items and the account actions. Clears the home indicator.
 */
export function BottomNav({ items, onMore, moreActive }) {
  const primary = items.filter((item) => item.primary).slice(0, 4);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg gap-1 px-2 py-1">
        {primary.map((item) => (
          <li key={item.to} className="flex flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => itemClasses(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Pill icon={item.icon} active={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-haspopup="dialog"
            className={itemClasses(moreActive)}
          >
            <Pill icon={Ellipsis} active={moreActive} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
