import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '../../utils/cn.js';
import { LogoLink } from '../brand/Logo.jsx';

/**
 * Desktop navigation (lg and up). Expanded: full logo and labels. Collapsed: footprint mark and
 * icons; labels stay in the DOM for screen readers and show as tooltips.
 */
export function Sidebar({ items, homeTo, collapsed, onToggle }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[4.75rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center',
          collapsed ? 'h-20 justify-center' : 'px-5 pt-5 pb-3',
        )}
      >
        {collapsed ? (
          <LogoLink to={homeTo} variant="mark" markSize={40} className="p-1" />
        ) : (
          <LogoLink to={homeTo} width={128} className="p-1" />
        )}
      </div>

      <nav id="sidebar-nav" aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-11 items-center gap-3 rounded-control font-semibold transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-brand-100 text-brand-800 before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-cerise-400'
                      : 'text-sand-700 hover:bg-blush-50 hover:text-ink',
                  )
                }
              >
                <item.icon aria-hidden="true" className="size-5 shrink-0" />
                <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('shrink-0 border-t border-line p-3', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-control font-semibold text-sand-600 hover:bg-blush-50 hover:text-ink',
            collapsed ? 'w-11 justify-center' : 'w-full px-3',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5" />
          ) : (
            <>
              <PanelLeftClose aria-hidden="true" className="size-5" />
              Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
